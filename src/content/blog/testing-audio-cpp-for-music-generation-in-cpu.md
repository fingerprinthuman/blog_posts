---
title: "Testing audio.cpp for Music Generation in CPU"
description: "I wanted to give audio.cpp a try to check how good the music quality generated on CPU is. Same setup as my image test: everything on CPU, YuE2 model family...."
pubDate: "2026-10-08T14:36:17.000Z"
tags: ["AI","CPU"]
draft: false
---

I wanted to give audio.cpp a try to check how good the music quality generated on CPU is. Same setup as my image test: everything on CPU, YuE2 model family. It runs. The quality stays low, and the files below show exactly where it stands.

The notebook is at experiments/audio\_cpu/audio-generation-cpu.ipynb. Everything runs on CPU. Cell 1 takes a while because audio.cpp has to be built from sources, and the repo contains hundreds of build targets.

**Cell 1 — install, clone, build CPU binary**

```
%%bash
# 1. Install reliable audio mastering packages (pedalboard installs cleanly in 3s)
pip install -q pedalboard soundfile huggingface_hub

# 2. Clone audio.cpp if not present
if [ ! -d "/kaggle/working/audio.cpp" ]; then
  git clone https://github.com/0xShug0/audio.cpp.git /kaggle/working/audio.cpp
fi

# 3. Build only the audiocpp_cli binary using official helper script
cd /kaggle/working/audio.cpp
chmod +x scripts/build_linux.sh
./scripts/build_linux.sh --backend cpu --target audiocpp_cli
```

Cell 2 downloads the YuE2 weights in GGUF form plus the sidecars:

**Cell 2 — download YuE2 weights**

```
import os
from huggingface_hub import snapshot_download
model_dir = "/kaggle/working/models"
os.makedirs(model_dir, exist_ok=True)
print("Downloading YuE2 Q4_0, VAE, and sidecars...")
snapshot_download(
    repo_id="audio-cpp/Yue2-3B-GGUF",
    allow_patterns=[
        "yue2-3b-q4_0.gguf",
        "yue2-vae-f16.gguf",
        "sidecars/*"
    ],
    local_dir=model_dir
)
```

Cell 3 runs generation on CPU with 4 threads, a lo-fi indie pop style and a short verse-chorus lyric:

**Cell 3 — generate on CPU**

```
%%bash
CLI_PATH="/kaggle/working/audio.cpp/build/linux-cpu-release/bin/audiocpp_cli"
if [ ! -f "$CLI_PATH" ]; then
  CLI_PATH="/kaggle/working/audio.cpp/build/bin/audiocpp_cli"
fi
echo "Using binary at: $CLI_PATH"
STYLE="lo-fi indie pop, warm acoustic guitar, mellow drums, clean vocals"
LYRICS="[verse]
Walking through the quiet rain
Watching all the colors fade away
[chorus]
Take me back to yesterday"
$CLI_PATH \
  --task gen \
  --family yue2 \
  --model /kaggle/working/models \
  --backend cpu \
  --threads 4 \
  --session-option yue2.model_gguf=yue2-3b-q4_0.gguf \
  --session-option yue2.vae_gguf=yue2-vae-f16.gguf \
  --text "$LYRICS" \
  --request-option "style=$STYLE" \
  --out "/kaggle/working/raw_output.wav"
```

Raw output (YuE2 directly, CPU):

<audio controls preload="none"><source src="https://cdn.jsdelivr.net/gh/fingerprinthuman/streaming@main/raw_output.mp3" type="audio/mpeg" />Your browser does not support audio playback.</audio>

That is the unprocessed generation. It has a song shape underneath, but the texture stays granular, with a fizzy edge on vocals and drums that never quite settles.

Cell 4 tries to fix that with a CPU DSP mastering chain in pedalboard: sub-bass cleanup, a cut against the boxy mid buildup, top-end air, bus compression, and a true-peak limiter:

**Cell 4 — master with pedalboard**

```
import os
import soundfile as sf
from pedalboard import Pedalboard, HighpassFilter, PeakFilter, HighShelfFilter, Compressor, Limiter
from pedalboard.io import AudioFile
def master_audio(input_path, output_path):
    print("Running CPU DSP Mastering...")
    board = Pedalboard([
        HighpassFilter(cutoff_frequency_hz=30.0),
        PeakFilter(cutoff_frequency_hz=320.0, gain_db=-3.0, q=1.0),
        HighShelfFilter(cutoff_frequency_hz=9000.0, gain_db=2.5),
        Compressor(threshold_db=-14.0, ratio=2.5, attack_ms=30.0, release_ms=100.0),
        Limiter(threshold_db=-1.0, release_ms=100.0)
    ])
    with AudioFile(input_path) as f:
        audio = f.read(f.frames)
        sr = f.samplerate
    mastered = board(audio, sr)
    with AudioFile(output_path, 'w', sr, mastered.shape[0]) as f:
        f.write(mastered)
    print(f"Mastering complete! Saved to: {output_path}")
master_audio("/kaggle/working/raw_output.wav", "/kaggle/working/mastered_final.wav")
```

Mastered output (pedalboard chain, CPU):

<audio controls preload="none"><source src="https://cdn.jsdelivr.net/gh/fingerprinthuman/streaming@main/mastered_final.mp3" type="audio/mpeg" />Your browser does not support audio playback.</audio>

Honestly, the master\_audio method is not helping. Levels are more even and the low end is cleaner, but the music keeps its granular sound. Mastering polishes the mix. It cannot replace the missing detail in the generation itself.

Cells 5 and 6 exist so the long build in Cell 1 does not have to run again. On Kaggle or Colab they copy the built binary aside, delete the source tree, and zip the binary for download:

**Cell 5 — keep the binary, drop the sources**

```
%%bash
mkdir -p /kaggle/working/audiocpp_bin
cp /kaggle/working/audio.cpp/build/linux-cpu-release/bin/audiocpp_cli /kaggle/working/audiocpp_bin/
chmod +x /kaggle/working/audiocpp_bin/audiocpp_cli
rm -rf /kaggle/working/audio.cpp
```

**Cell 6 — zip the binary for download**

```
import shutil
from IPython.display import FileLink
shutil.make_archive("/kaggle/working/audiocpp_bin", 'zip', "/kaggle/working/audiocpp_bin")
FileLink("audiocpp_bin.zip")
```

The last cell, Cell 7, shows how the saved binary can be tested without rebuilding anything:

**Cell 7 — smoke-test the saved binary**

```
%%bash
/kaggle/working/audiocpp_bin/audiocpp_cli --help | head -n 5
```

So the loop is short: build once, stash the binary, test with --help next session. Generation itself works on CPU. What remains low is the sound, not the setup.
