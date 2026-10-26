// Figma Plugin Backend Sandbox (code.js)
figma.showUI(__html__, { width: 350, height: 680, themeColors: true });

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
    figma.ui.postMessage({ type: 'SELECTION_CHANGED', hasImage: false, message: 'Выберите картинку или фигуру с изображением' });
    return;
  }

  const node = selection[0];
  const imageInfo = getImageFill(node);
  if (!imageInfo) {
    figma.ui.postMessage({ type: 'SELECTION_CHANGED', hasImage: false, message: 'У выбранного слоя нет заливки изображением' });
    return;
  }

  // Preserve original image hash in pluginData for non-destructive workflow
  let originalHash = node.getPluginData('originalImageHash');
  if (!originalHash) {
    originalHash = imageInfo.fill.imageHash;
    node.setPluginData('originalImageHash', originalHash);
  }

  const savedSettings = node.getPluginData('colorSettings');
  const image = figma.getImageByHash(originalHash) || figma.getImageByHash(imageInfo.fill.imageHash);

  if (!image) {
    figma.ui.postMessage({ type: 'SELECTION_CHANGED', hasImage: false, message: 'Не удалось прочитать изображение' });
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
    figma.ui.postMessage({ type: 'SELECTION_CHANGED', hasImage: false, message: 'Ошибка чтения байтов картинки' });
  }
}

figma.on('selectionchange', () => {
  sendSelection();
});

// Initial inspection
sendSelection();

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'LIVE_UPDATE' || msg.type === 'APPLY_IMAGE') {
    const node = figma.getNodeById(msg.nodeId);
    if (!node) {
      if (msg.type === 'APPLY_IMAGE') figma.notify('Слой был удален или перемещен');
      return;
    }

    const imageInfo = getImageFill(node);
    if (!imageInfo) {
      if (msg.type === 'APPLY_IMAGE') figma.notify('У слоя нет заливки картинкой');
      return;
    }

    try {
      const newImage = figma.createImage(new Uint8Array(msg.bytes));
      const newFills = JSON.parse(JSON.stringify(node.fills));
      newFills[imageInfo.index].imageHash = newImage.hash;
      node.fills = newFills;

      if (msg.settings) {
        node.setPluginData('colorSettings', JSON.stringify(msg.settings));
      }
      if (msg.type === 'APPLY_IMAGE') {
        figma.notify('✓ Цветокоррекция сохранена!');
      }
    } catch (e) {
      if (msg.type === 'APPLY_IMAGE') figma.notify('Ошибка применения: ' + e);
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
        figma.notify('Восстановлен исходный вид');
        sendSelection();
      }
    }
  } else if (msg.type === 'RESIZE_WINDOW') {
    figma.ui.resize(msg.width || 350, msg.height || 680);
  } else if (msg.type === 'NOTIFY') {
    figma.notify(msg.text);
  } else if (msg.type === 'CLOSE') {
    figma.closePlugin();
  }
};
