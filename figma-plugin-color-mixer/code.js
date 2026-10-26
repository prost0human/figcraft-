// Figma Plugin Backend Sandbox (code.js)
figma.showUI(__html__, { width: 360, height: 720, themeColors: true });

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

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const h = Math.max(0, Math.min(255, Math.round(x))).toString(16);
    return h.length === 1 ? '0' + h : h;
  }).join('').toUpperCase();
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
    // If selected layer is NOT an image, inform UI so user can still sample colors from it
    let solidColor = null;
    if (node.fills && Array.isArray(node.fills)) {
      for (const f of node.fills) {
        if (f.visible !== false && f.type === 'SOLID' && f.color) {
          solidColor = rgbToHex(f.color.r * 255, f.color.g * 255, f.color.b * 255);
          break;
        }
      }
    }
    figma.ui.postMessage({
      type: 'SELECTION_CHANGED',
      hasImage: false,
      message: 'Выбран слой без картинки (' + node.name + ')',
      layerColor: solidColor,
      layerName: node.name
    });
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
      const newFills = node.fills.slice();
      newFills[imageInfo.index] = Object.assign({}, newFills[imageInfo.index], { imageHash: newImage.hash });
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
  } else if (msg.type === 'GET_SELECTION_COLOR') {
    // Sample color from current selection on Figma canvas
    const selection = figma.currentPage.selection;
    if (!selection || selection.length === 0) {
      figma.notify('Выберите фигуру на холсте Figma для взятия цвета');
      return;
    }
    const node = selection[0];
    let hex = null;

    if (node.fills && Array.isArray(node.fills)) {
      for (const f of node.fills) {
        if (f.visible !== false && f.type === 'SOLID' && f.color) {
          hex = rgbToHex(f.color.r * 255, f.color.g * 255, f.color.b * 255);
          break;
        }
      }
    }

    if (hex) {
      figma.ui.postMessage({
        type: 'LAYER_COLOR_PICKED',
        targetSlot: msg.targetSlot,
        hex: hex,
        layerName: node.name
      });
      figma.notify('✓ Цвет ' + hex + ' взят со слоя «' + node.name + '»');
    } else {
      figma.notify('У выбранного слоя «' + node.name + '» нет сплошной заливки (Solid Fill)');
    }
  } else if (msg.type === 'RESTORE_ORIGINAL') {
    const node = figma.getNodeById(msg.nodeId);
    if (!node) return;
    const origHash = node.getPluginData('originalImageHash');
    if (origHash) {
      const imageInfo = getImageFill(node);
      if (imageInfo) {
        const newFills = node.fills.slice();
        newFills[imageInfo.index] = Object.assign({}, newFills[imageInfo.index], { imageHash: origHash });
        node.fills = newFills;
        node.setPluginData('colorSettings', '');
        figma.notify('Восстановлен исходный вид');
        sendSelection();
      }
    }
  } else if (msg.type === 'RESIZE_WINDOW') {
    figma.ui.resize(msg.width || 360, msg.height || 720);
  } else if (msg.type === 'NOTIFY') {
    figma.notify(msg.text);
  } else if (msg.type === 'CLOSE') {
    figma.closePlugin();
  }
};
