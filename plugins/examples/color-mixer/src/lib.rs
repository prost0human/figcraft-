//! Color Mixer & Lightroom Adjust plugin for FigCraft.
//!
//! Provides channel-based HSL color adjustments, vibrance, white balance,
//! and photographic presets for raster image fills.

use figcraft_plugin_sdk::{
    Event, Input, Result, Value, call, close_ui, entry, json, notify, set_setting, setting, show_ui,
};

/// Preset definitions: (name, temp, tint, vibrance, channel, hue, sat, lum).
const PRESETS: &[(&str, f64, f64, f64, &str, f64, f64, f64)] = &[
    ("Warm Sunset", 25.0, 5.0, 20.0, "Orange", 10.0, 35.0, 5.0),
    ("Cool Film", -25.0, -5.0, 15.0, "Blue", -10.0, 30.0, 0.0),
    ("Vivid Landscape", 5.0, 0.0, 35.0, "Green", 5.0, 40.0, 10.0),
    ("Moody Teal", -15.0, 10.0, 10.0, "Aqua", 0.0, 25.0, -10.0),
];

fn run(input: Input) -> Result<Value> {
    if let Some(event) = input.event {
        return handle_panel_event(event);
    }

    match input.command.as_str() {
        "panel" => {
            show_main_panel("Warm Sunset", "Red", 0.0, 0.0, 0.0, 0.0, 0.0, 0.0)?;
            Ok(json!({"panel": "open"}))
        }
        "warm_sunset" => apply_named_preset("Warm Sunset"),
        "cool_film" => apply_named_preset("Cool Film"),
        "vivid_landscape" => apply_named_preset("Vivid Landscape"),
        "custom" => {
            let ch = input.str("channel").unwrap_or("Red");
            let hue = (input.f64("hue").unwrap_or(0.0) / 100.0).clamp(-1.0, 1.0);
            let sat = (input.f64("saturation").unwrap_or(0.0) / 100.0).clamp(-1.0, 1.0);
            let lum = (input.f64("luminance").unwrap_or(0.0) / 100.0).clamp(-1.0, 1.0);
            let vib = (input.f64("vibrance").unwrap_or(0.0) / 100.0).clamp(-1.0, 1.0);

            let res = call(
                "image.adjust",
                &json!({
                    "filters": {
                        "vibrance": vib,
                        "mixer": {
                            ch.to_ascii_lowercase(): {
                                "hue": hue,
                                "saturation": sat,
                                "luminance": lum
                            }
                        }
                    }
                }),
            )?;

            notify(&alloc::format!("Applied custom adjustment to channel {ch}"));
            Ok(res)
        }
        _ => Err(alloc::format!("Unknown command: {}", input.command)),
    }
}

fn apply_named_preset(name: &str) -> Result<Value> {
    let preset = PRESETS.iter().find(|(n, ..)| *n == name);
    let Some(&(_, temp, tint, vib, ch, hue, sat, lum)) = preset else {
        return Err(alloc::format!("Preset `{name}` not found"));
    };

    let res = call(
        "image.adjust",
        &json!({
            "filters": {
                "temperature": temp / 100.0,
                "tint": tint / 100.0,
                "vibrance": vib / 100.0,
                "mixer": {
                    ch.to_ascii_lowercase(): {
                        "hue": hue / 100.0,
                        "saturation": sat / 100.0,
                        "luminance": lum / 100.0
                    }
                }
            }
        }),
    )?;

    notify(&alloc::format!("Preset applied: {name}"));
    Ok(res)
}

fn show_main_panel(
    preset_name: &str,
    channel: &str,
    temp: f64,
    tint: f64,
    vib: f64,
    hue: f64,
    sat: f64,
    lum: f64,
) -> Result<()> {
    let preset_options: alloc::vec::Vec<&str> = PRESETS.iter().map(|(n, ..)| *n).collect();
    let channel_options = [
        "Red", "Orange", "Yellow", "Green", "Aqua", "Blue", "Purple", "Magenta",
    ];

    let panel = json!({
        "title": "Lightroom Color Mixer",
        "controls": [
            {
                "type": "select",
                "name": "preset",
                "label": "Photo Preset",
                "options": preset_options,
                "value": preset_name
            },
            { "type": "note", "label": "Adjust global temperature, tint and vibrance:" },
            {
                "type": "number",
                "name": "temp",
                "label": "Temp (-100..100)",
                "min": -100,
                "max": 100,
                "value": temp
            },
            {
                "type": "number",
                "name": "tint",
                "label": "Tint (-100..100)",
                "min": -100,
                "max": 100,
                "value": tint
            },
            {
                "type": "number",
                "name": "vibrance",
                "label": "Vibrance (-100..100)",
                "min": -100,
                "max": 100,
                "value": vib
            },
            { "type": "note", "label": "Per-channel HSL Color Mixer:" },
            {
                "type": "select",
                "name": "channel",
                "label": "Target Channel",
                "options": channel_options,
                "value": channel
            },
            {
                "type": "number",
                "name": "hue",
                "label": "Channel Hue",
                "min": -100,
                "max": 100,
                "value": hue
            },
            {
                "type": "number",
                "name": "sat",
                "label": "Channel Saturation",
                "min": -100,
                "max": 100,
                "value": sat
            },
            {
                "type": "number",
                "name": "lum",
                "label": "Channel Luminance",
                "min": -100,
                "max": 100,
                "value": lum
            },
            { "type": "button", "name": "apply", "label": "Apply Adjustments" },
            { "type": "button", "name": "reset", "label": "Reset to Defaults" },
            { "type": "button", "name": "close", "label": "Close" }
        ]
    });

    show_ui(&panel)
}

fn handle_panel_event(event: Event) -> Result<Value> {
    if event.control == "close" {
        close_ui();
        return Ok(json!({"closed": true}));
    }

    if event.control == "reset" {
        call("image.adjust", &json!({"preset": "reset"}))?;
        notify("Reset adjustments to defaults");
        show_main_panel("Warm Sunset", "Red", 0.0, 0.0, 0.0, 0.0, 0.0, 0.0)?;
        return Ok(json!({"reset": true}));
    }

    let values = event.values;
    let preset = values.get("preset").and_then(|v| v.as_str()).unwrap_or("Warm Sunset");
    let channel = values.get("channel").and_then(|v| v.as_str()).unwrap_or("Red");

    if event.control == "preset" {
        if let Some(&(_, p_temp, p_tint, p_vib, p_ch, p_hue, p_sat, p_lum)) =
            PRESETS.iter().find(|(n, ..)| *n == preset)
        {
            show_main_panel(preset, p_ch, p_temp, p_tint, p_vib, p_hue, p_sat, p_lum)?;
            return apply_named_preset(preset);
        }
    }

    let temp = values.get("temp").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let tint = values.get("tint").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let vib = values.get("vibrance").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let hue = values.get("hue").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let sat = values.get("sat").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let lum = values.get("lum").and_then(|v| v.as_f64()).unwrap_or(0.0);

    let res = call(
        "image.adjust",
        &json!({
            "filters": {
                "temperature": temp / 100.0,
                "tint": tint / 100.0,
                "vibrance": vib / 100.0,
                "mixer": {
                    channel.to_ascii_lowercase(): {
                        "hue": hue / 100.0,
                        "saturation": sat / 100.0,
                        "luminance": lum / 100.0
                    }
                }
            }
        }),
    )?;

    notify(&alloc::format!("Updated color adjustments for {channel}"));
    Ok(res)
}

entry!(run);
