import { useEffect, useState, type FormEvent } from "react";
import type { GeneratedPetOptions } from "../shared/contracts";

const shapes = [
  { id: "cat", label: "小猫" },
  { id: "dragon", label: "小龙" },
  { id: "bean", label: "团子" },
] as const;
const eyeStyles = [
  { id: "round", label: "圆眼" },
  { id: "sleepy", label: "眯眼" },
  { id: "sparkle", label: "星星眼" },
] as const;
const colors = ["#f5c46b", "#afd9c9", "#efb8cf", "#bfc5f1", "#d4b8e9"];

interface CreatorPanelProps {
  onCreated(): Promise<void>;
  onClose(): void;
}

export function CreatorPanel({ onCreated, onClose }: CreatorPanelProps) {
  const [options, setOptions] = useState<GeneratedPetOptions>({
    name: "我的小伙伴",
    shape: "cat",
    color: colors[0],
    eyes: "round",
  });
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    window.petMarket.previewGenerated(options).then((image) => {
      if (active) setPreview(image);
    }).catch((failure: Error) => {
      if (active) setError(failure.message);
    });
    return () => { active = false; };
  }, [options]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await window.petMarket.createGenerated(options);
      await onCreated();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="creator-panel" aria-labelledby="creator-title">
      <div className="creator-heading">
        <div>
          <span className="eyebrow">MAKE YOUR OWN PET</span>
          <h2 id="creator-title">捏一个自己的小伙伴</h2>
          <p>选造型、颜色和表情，做出的宠物只保存在这台电脑。</p>
        </div>
        <button type="button" className="remove-button" onClick={onClose}>收起</button>
      </div>
      <form className="creator-content" onSubmit={save}>
        <div className="creator-preview">
          {preview && <img src={preview} alt="当前宠物设计预览" />}
        </div>
        <div className="creator-fields">
          <label htmlFor="creator-name">给它起名</label>
          <input id="creator-name" value={options.name} maxLength={32} required
            onChange={(event) => setOptions({ ...options, name: event.target.value })} />
          <fieldset>
            <legend>造型</legend>
            {shapes.map((shape) => (
              <label key={shape.id}>
                <input type="radio" name="creator-shape" value={shape.id}
                  checked={options.shape === shape.id}
                  onChange={() => setOptions({ ...options, shape: shape.id })} />
                {shape.label}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>颜色</legend>
            <div className="color-options">
              {colors.map((color) => (
                <label key={color} title={color}>
                  <input type="radio" name="creator-color" value={color}
                    aria-label={"颜色 " + color} checked={options.color === color}
                    onChange={() => setOptions({ ...options, color })} />
                  <span style={{ backgroundColor: color }} />
                </label>
              ))}
              <label className="custom-color">自选颜色
                <input type="color" aria-label="自选颜色" value={options.color}
                  onChange={(event) => setOptions({ ...options, color: event.target.value })} />
              </label>
            </div>
          </fieldset>
          <fieldset>
            <legend>表情</legend>
            {eyeStyles.map((eyes) => (
              <label key={eyes.id}>
                <input type="radio" name="creator-eyes" value={eyes.id}
                  checked={options.eyes === eyes.id}
                  onChange={() => setOptions({ ...options, eyes: eyes.id })} />
                {eyes.label}
              </label>
            ))}
          </fieldset>
          {error && <p className="creator-error" role="alert">{error}</p>}
          <button id="create-pet" className="import-button" type="submit" disabled={saving}>
            {saving ? "正在保存…" : "让它来到桌面"}
          </button>
        </div>
      </form>
    </section>
  );
}
