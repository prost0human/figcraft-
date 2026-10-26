// Figma Plugin Backend Sandbox (code.js)
figma.showUI(__html__, { width: 360, height: 740, themeColors: true });

function getImageFill(node) {
  if (!node || !node.fills || !Array.isArray(node.fills)) return null;
  for (let i = node.fills.length - 1; i >= 0; i--) {
    const fill = node.fills[i];
    if (fill.type === 'IMAGE' && fill.imageHash) {
      return { fill, index: i };
    }
  }
  return null;
}

async function sendSelection() {
  const selection = figma.currentPage.selection;
  if (!selection || selection.length === 0) {
    figma.ui.postMessage({ type: 'SELECTION_CHANGED', hasImage: false, message: 'Select an image or shape with image fill' });
    return;
  }

  const node = selection[0];
  const imageInfo = getImageFill(node);
  if (!imageInfo) {
    figma.ui.postMessage({ type: 'SELECTION_CHANGED', hasImage: false, message: 'Selected layer has no image fill' });
    return;
  }

  // Check if we have an original image preserved in plugin data
  let originalHash = node.getPluginData('originalImageHash');
  if (!originalHash) {
    originalHash = imageInfo.fill.imageHash;
    node.setPluginData('originalImageHash', originalHash);
  }

  const savedSettings = node.getPluginData('colorSettings');
  const image = figma.getImageByHash(originalHash) || figma.getImageByHash(imageInfo.fill.imageHash);

  if (!image) {
    figma.ui.postMessage({ type: 'SELECTION_CHANGED', hasImage: false, message: 'Could not load image bytes' });
    return;
  }

  try {
    const bytes = await image.getBytesAsync();
    figma.ui.postMessage({
      type: 'SELECTION_CHANGED',
      hasImage: true,
      nodeId: node.id,
      nodeName: node.name,
      imageBytes: bytes,
      savedSettings: savedSettings ? JSON.parse(savedSettings) : null
    });
  } catch (err) {
    figma.ui.postMessage({ type: 'SELECTION_CHANGED', hasImage: false, message: 'Error reading image bytes' });
  }
}

figma.on('selectionchange', () => {
  sendSelection();
});

// Initial inspection
sendSelection();

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'APPLY_IMAGE') {
    const node = figma.getNodeById(msg.nodeId);
    if (!node) {
      figma.notify('Selected layer was deleted or moved');
      return;
    }

    const imageInfo = getImageFill(node);
    if (!imageInfo) {
      figma.notify('Layer has no image fill');
      return;
    }

    try {
      const newImage = figma.createImage(new Uint8Array(msg.bytes));
      const newFills = JSON.parse(JSON.stringify(node.fills));
      newFills[imageInfo.index].imageHash = newImage.hash;
      node.fills = newFills;

      // Persist settings for future non-destructive adjustments
      if (msg.settings) {
        node.setPluginData('colorSettings', JSON.stringify(msg.settings));
      }
      figma.notify('✓ Color adjustments applied!');
    } catch (e) {
      figma.notify('Error applying image: ' + e);
    }
  } else if (msg.type === 'RESTORE_ORIGINAL') {
    const node = figma.getNodeById(msg.nodeId);
    if (!node) return;
    const origHash = node.getPluginData('originalImageHash');
    if (origHash) {
      const imageInfo = getImageFill(node);
      if (imageInfo) {
        const newFills = JSON.parse(JSON.stringify(node.fills));
        newFills[imageInfo.index].imageHash = origHash;
        node.fills = newFills;
        node.setPluginData('colorSettings', '');
        figma.notify('Restored original image');
        sendSelection();
      }
    }
  } else if (msg.type === 'NOTIFY') {
    figma.notify(msg.text);
  } else if (msg.type === 'CLOSE') {
    figma.closePlugin();
  }
};
