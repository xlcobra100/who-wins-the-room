import json, sys, soundfile as sf, numpy as np
from kokoro_onnx import Kokoro
k = Kokoro("kokoro-v1.0.onnx", "voices-v1.0.bin")
V = {"narrator": ("af_heart", 1.0), "A": ("bm_george", 1.0), "B": ("am_michael", 1.05), "minister": ("bf_emma", 1.0)}
segs = json.load(open("segments.json", encoding="utf-8"))
only = sys.argv[1:]
for s in segs:
    if only and s["id"] not in only: continue
    voice, speed = V[s["voice"]]
    audio, sr = k.create(s["say"], voice=voice, speed=speed, lang="en-us")
    sf.write(f"{s['id']}.wav", audio, sr)
    print(s["id"], voice, round(len(audio)/sr, 2), "s")
