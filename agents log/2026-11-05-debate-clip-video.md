# 2026-11-05 — Narrated video clip of debate p3-41

## Changed
- **New `study/clip/`** holds a small pipeline that turns one debate into a narrated 1080p MP4:
  - `segments.json`: the script. Each segment has a kind (title, setup, speech, tally, beat, minister, check, end), a voice, and the excerpt text. `show` is the on-screen text and `say` is what gets spoken.
  - `tts.py`: Kokoro-82M (ONNX) voices, run locally. narrator=af_heart, Robin (A)=bm_george, Drew (B)=am_michael, minister=bf_emma.
  - `frames.mjs`: writes one HTML frame per segment and screenshots it with headless Chrome at 1920×1080. Also writes `manifest.json` (where each waveform goes).
  - `build.mjs`: uses ffmpeg to build each segment from its still, voice and a live `showwaves` waveform under the speaker. It joins them with 0.3 s xfade/acrossfade and applies loudnorm.
- **New `study/runs/main/clips/`**:
  - `p3-41-one-closing-line.mp4` (98 s, about 11 MB)
  - two stills for slides: the closing line and the final vote.

## Why
The user is presenting the study and asked for a short clip of the agents debating, with audio if possible. p3-41 was chosen because it carries both stories at once: a swing (Robin leads 4–0, then Drew's last line moves three ministers to win 3–2) and a distortion (the "permanent 10% loss" happens with or without the contract). The highlights page has the full write-up: `study/runs/main/highlights.html` (#swings).

## Not changed
- No study code or data was touched. The clip only reads `runs/main/debates/p3-41-*.json` and the brief.
- The Kokoro model files (~350 MB) and the venv were NOT copied into the project. They lived in the job temp dir, which is gone once the job is deleted.

## Surprises for the next agent
- Excerpts are verbatim, with `…` on screen where text was cut. Robin's opening audio drops the middle clause ("doubles their electricity supply…") and the screen shows `…`.
- The minister quote is L2's final `why`. "Three ministers moved" means L2, L4 and L5. L5 was undecided rather than on Robin's side, but the MOVED tag still applies, because each of the three ended on a different side from where they stood before.
- Twist used in the fact-check card: Robin's own closing (one speech before Drew's) already said the 10% comes from "evaporation and irrigation". Drew spoke last, so it went unanswered.
- p3-41 uses river brief v1. The relevant sentence is identical in v1 and v2 (`scenarios.v1.mjs:97`, `scenarios.mjs:100`).
- The scripts read from and write to their own folder (PNGs, WAVs, seg_*.mkv). Run them in a scratch copy, not in `study/clip/`.

## How to verify / rebuild
1. Copy `study/clip/` to a scratch folder. Run `uv venv -p 3.11 .venv && uv pip install -p .venv/Scripts/python.exe kokoro-onnx soundfile`.
2. In that folder, download `kokoro-v1.0.onnx` and `voices-v1.0.bin` from github.com/thewh1teagle/kokoro-onnx, release `model-files-v1.0`.
3. Run `.venv/Scripts/python.exe -I tts.py`, then `node frames.mjs`, then `node build.mjs out.mp4`.
4. `ffprobe out.mp4` should show h264 1920×1080 plus aac, about 98 s.
