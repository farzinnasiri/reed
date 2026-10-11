# Reed sounds

Selected portable assets from [UI SFX 0.4.0](https://www.npmjs.com/package/uisfx), by Romain Simon / Yuki Capital. Audio is [CC0](https://github.com/romainsimon/uisfx/blob/main/LICENSE-AUDIO); the dedication is retained in `LICENSE-CC0.txt`. Reed does not install the web-only synthesis runtime or the full library.

| Reed file | Original file in UI SFX | Playback |
|:--|:--|:--|
| `reed_reply.mp3` | `sounds/zen/receive.mp3` | 0.12 gain, fresh visible reply only |
| `saved.mp3` | `sounds/zen/success.mp3` | 0.14 gain, profile, goal, weight and quick-log saves |
| `onboarding_complete.mp3` | `sounds/zen/complete.mp3` | 0.24 gain, persisted onboarding completion |
| `workout_start.mp3` | `sounds/studio/start.mp3` | 0.28 gain, created session only |
| `workout_complete.mp3` | `sounds/studio/complete.mp3` | 0.26 gain, saved workout with logged sets |
| `rest_timer_complete.wav` | `sounds/studio/notification.mp3` | 0.35 baked gain, foreground and native notification |

Everyday MP3 files are unmodified. Workout start, finish and rest cues are lowered seven semitones with their high frequencies softened by a 1.6kHz low-pass filter. Tempo compensation keeps them brief. The rest file is converted to mono 44.1kHz PCM WAV so native notification playback uses the same quieter cue. Regenerate from the pinned package with:

```sh
workout_filter='asetrate=44100*0.6674199271,aresample=44100,atempo=1.4983070769,lowpass=f=1600:p=2'
ffmpeg -i sounds/studio/start.mp3 -af "$workout_filter" -c:a libmp3lame -b:a 64k workout_start.mp3
ffmpeg -i sounds/studio/complete.mp3 -af "$workout_filter" -c:a libmp3lame -b:a 64k workout_complete.mp3
ffmpeg -i sounds/studio/notification.mp3 -af "$workout_filter,volume=0.35" -ar 44100 -ac 1 -c:a pcm_s16le rest_timer_complete.wav
```

The selected audio totals 65,313 bytes. Zen supplies warm, gentle everyday cues; the lowered Studio cues give workouts firmer attacks without the original high-pitched brightness, a looping soundtrack or per-set sound. This selection uses the upstream pack descriptions and the owner's listening feedback; device listening still decides the final feel.

## Playback decisions

- [Expo Audio](https://docs.expo.dev/versions/latest/sdk/audio/) already ships in Reed and handles native playback. Cues mix with music, respect silent mode, have one active voice and release their players when the root lifecycle ends. Recording suppresses both pending and active cues. Each outcome restores playback settings because Expo's audio mode is global and recording changes it.
- Web uses the same bundled files through [Web Audio](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API), unlocked by a trusted pointer or keyboard interaction. Browser autoplay restrictions can keep a cue silent. There is no queued replay or notification fallback. PWA sound follows browser/device audio behavior; web cannot promise native silent-switch control or a reliable locked-screen rest alarm.
- [UI SFX](https://github.com/romainsimon/uisfx) was selected for its portable files and CC0 audio. [Semantic Sounds](https://github.com/BirdTempo/semantic-sounds) is another TypeScript option, but its native rendering/file adapter adds work that these six bundled clips do not need. Web-only sound hooks would still need a native player.
- Native custom notification files are embedded by the Expo notifications plugin. The replacement background rest sound and Android v4 channels need a rebuilt native binary. Foreground assets can be delivered with the JS bundle. Android channels are versioned because an existing channel's sound is controlled by the OS/user after creation.

You → Preferences → Sound effects stores the choice on this device, independently of haptics and coach notifications. Off cancels active/pending foreground audio and reschedules a running rest notification onto a silent channel, keeping the visual alert and system vibration. There are preview buttons for the everyday and workout moods.
