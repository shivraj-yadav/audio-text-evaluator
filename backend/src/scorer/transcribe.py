#!/usr/bin/env python3
import sys, json, os

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "no_audio_path"}))
        return 1
    audio_path = sys.argv[1]
    lang = os.environ.get('WHISPER_LANG', 'en')  # bias to English by default
    initial_prompt = os.environ.get('ASR_INITIAL_PROMPT', '')  # bias for names/terms

    # Try faster-whisper first (faster, good accuracy)
    try:
        from faster_whisper import WhisperModel
        model_name = os.environ.get('WHISPER_MODEL', 'small')  # small for better names vs tiny
        device = os.environ.get('WHISPER_DEVICE', 'cpu')
        compute_type = os.environ.get('WHISPER_COMPUTE_TYPE', 'int8')  # int8 or float16
        model = WhisperModel(model_name, device=device, compute_type=compute_type)

        # Use beam search, temperature fallback, and VAD to improve segmentation
        segments, info = model.transcribe(
            audio_path,
            language=lang,
            beam_size=5,
            best_of=5,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 250},
            temperature=[0.0, 0.2, 0.4],
            initial_prompt=initial_prompt or None,
        )
        text = ''.join(seg.text for seg in segments).strip()
        print(json.dumps({"text": text}))
        return 0
    except Exception as e:
        # Fall back to openai-whisper if available
        try:
            import whisper as ow
            model_name = os.environ.get('WHISPER_MODEL', 'small')
            model = ow.load_model(model_name)
            # Use beam search and temperature; disable conditioning to reduce drift
            result = model.transcribe(
                audio_path,
                language=lang,
                temperature=0.0,
                beam_size=5,
                best_of=5,
                condition_on_previous_text=False,
                initial_prompt=initial_prompt or None,
            )
            print(json.dumps({"text": result.get('text', '').strip()}))
            return 0
        except Exception as e2:
            print(json.dumps({"error": "asr_dependencies_missing", "detail": str(e2)}))
            return 2

if __name__ == '__main__':
    sys.exit(main())
