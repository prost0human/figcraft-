# Color Mixer & Lightroom Adjust — FigCraft Plugin

Плагин для поканальной цветокоррекции растровых изображений и применения фото-пресетов (Warm Sunset, Cool Film, Vivid Landscape, Moody Teal) в FigCraft.

## Содержимое пакета
* `figcraft-plugin.json` — манифест плагина.
* `Cargo.toml` — манифест Rust для сборки cdylib WebAssembly модуля.
* `src/lib.rs` — исходный код плагина с использованием `figcraft-plugin-sdk`.

## Как собрать плагин

Для сборки требуется компилятор Rust с целевой платформой WebAssembly:
```bash
# 1. Установите target wasm32 (если еще не установлен)
rustup target add wasm32-unknown-unknown

# 2. Соберите модуль плагина в папке плагина
cargo build --release --target wasm32-unknown-unknown

# 3. Скопируйте скомпилированный модуль рядом с манифестом
cp target/wasm32-unknown-unknown/release/color_mixer.wasm ./
```

Либо из корня репозитория FigCraft с помощью встроенного таска:
```bash
cargo xtask plugins
```
(Собранный плагин и манифест автоматически попадут в `target/plugins/dist/color-mixer/`).

## Как установить плагин в FigCraft

1. Запустите FigCraft на вашем ПК.
2. В верхнем меню перейдите: **Plugins ▸ Development ▸ Import plugin from manifest…**
3. Выберите файл `figcraft-plugin.json` из этой папки.
4. Плагин появится в меню **Plugins** со следующими командами:
   * **Color Mixer Panel…** — открывает плавающую панель с выбором пресетов, балансом белого, вибрацией и поканальным HSL-микшером.
   * **Preset: Warm Sunset** — теплый кинематографичный закат с акцентом на оранжево-красных тонах.
   * **Preset: Cool Film** — холодная пленочная гамма с акцентом на голубых и синих оттенках.
   * **Preset: Vivid Landscape** — сочные пейзажные зеленые и аквамариновые оттенки.
   * **Custom Channel Adjust…** — форма точечной поканальной настройки с выбором целевого цвета (Red, Orange, Yellow, Green, Aqua, Blue, Purple, Magenta).
