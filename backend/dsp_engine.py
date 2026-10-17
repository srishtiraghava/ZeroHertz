"""Digital Signal Processing (DSP) Engine with Goertzel DTMF Decoder and Streaming State Machine."""

import base64
import io
import math
import struct
import wave
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import numpy as np
from backend.config import settings

# DTMF Frequencies (Hz)
LOW_FREQUENCIES = [697, 770, 852, 941]
HIGH_FREQUENCIES = [1209, 1336, 1477, 1633]

# DTMF 4x4 Keypad Mapping: (low_freq, high_freq) -> key
DTMF_MAP = {
    (697, 1209): "1", (697, 1336): "2", (697, 1477): "3", (697, 1633): "A",
    (770, 1209): "4", (770, 1336): "5", (770, 1477): "6", (770, 1633): "B",
    (852, 1209): "7", (852, 1336): "8", (852, 1477): "9", (852, 1633): "C",
    (941, 1209): "*", (941, 1336): "0", (941, 1477): "#", (941, 1633): "D",
}

# Reverse mapping: key -> (low_freq, high_freq)
KEY_TO_FREQ = {v: k for k, v in DTMF_MAP.items()}


def _build_mulaw_table() -> np.ndarray:
    """Precompute ITU-T G.711 mu-law 8-bit to float32 linear lookup table."""
    table = np.zeros(256, dtype=np.float32)
    for i in range(256):
        u = (~i) & 0xFF
        sign = u & 0x80
        exponent = (u >> 4) & 0x07
        mantissa = u & 0x0F
        sample = ((mantissa << 3) + 0x84) << exponent
        sample = sample - 0x84
        if sign == 0:
            sample = -sample
        table[i] = np.clip(sample / 32768.0, -1.0, 1.0)
    return table


MULAW_TABLE = _build_mulaw_table()


def decode_mulaw(audio_bytes: bytes) -> np.ndarray:
    """Decode raw G.711 mu-law 8-bit stream to normalized float32 samples [-1.0, 1.0]."""
    raw_indices = np.frombuffer(audio_bytes, dtype=np.uint8)
    return MULAW_TABLE[raw_indices]


def goertzel_power(samples: np.ndarray, target_freq: float, sample_rate: int) -> float:
    """Compute power at a target frequency using 2nd-order Goertzel algorithm.
    
    Formula:
      omega = 2 * pi * target_freq / sample_rate
      coeff = 2 * cos(omega)
      s[n] = x[n] + coeff * s[n-1] - s[n-2]
      Power = s[N-1]^2 + s[N-2]^2 - coeff * s[N-1] * s[N-2]
    Normalized by (N/2)^2 to reflect amplitude-squared.
    """
    n = len(samples)
    if n == 0:
        return 0.0

    omega = 2.0 * math.pi * target_freq / sample_rate
    coeff = 2.0 * math.cos(omega)

    s_prev = 0.0
    s_prev2 = 0.0

    for x in samples:
        s = float(x) + coeff * s_prev - s_prev2
        s_prev2 = s_prev
        s_prev = s

    power = s_prev * s_prev + s_prev2 * s_prev2 - coeff * s_prev * s_prev2
    # Normalization scaling factor: (N / 2)^2
    norm = (n / 2.0) ** 2
    return max(0.0, power / norm) if norm > 0 else 0.0


@dataclass
class FrameDetection:
    """Result of analyzing an individual audio block."""
    frame_index: int
    timestamp_ms: float
    detected_key: Optional[str]
    low_freq: Optional[float]
    high_freq: Optional[float]
    low_power: float
    high_power: float
    total_energy: float
    twist_db: Optional[float]
    second_harmonic_ratio: Optional[float]
    is_valid: bool
    rejection_reason: Optional[str] = None


class GoertzelDTMFEngine:
    """Mathematical DTMF signal detector executing 2nd-order Goertzel transforms."""

    def __init__(
        self,
        energy_threshold: float = settings.DSP_ENERGY_THRESHOLD,
        twist_min_db: float = settings.DSP_TWIST_MIN_DB,
        twist_max_db: float = settings.DSP_TWIST_MAX_DB,
        second_harmonic_max_ratio: float = settings.DSP_SECOND_HARMONIC_MAX_RATIO,
    ):
        self.energy_threshold = energy_threshold
        self.twist_min_db = twist_min_db
        self.twist_max_db = twist_max_db
        self.second_harmonic_max_ratio = second_harmonic_max_ratio

    def analyze_frame(
        self,
        samples: np.ndarray,
        sample_rate: int,
        frame_index: int = 0,
        timestamp_ms: float = 0.0,
    ) -> FrameDetection:
        """Analyze a single audio frame of normalized float samples in [-1.0, 1.0]."""
        n_samples = len(samples)
        if n_samples < 32:
            return FrameDetection(
                frame_index=frame_index,
                timestamp_ms=timestamp_ms,
                detected_key=None,
                low_freq=None,
                high_freq=None,
                low_power=0.0,
                high_power=0.0,
                total_energy=0.0,
                twist_db=None,
                second_harmonic_ratio=None,
                is_valid=False,
                rejection_reason="Frame too short (<32 samples)",
            )

        # Check clipping: if >2% of samples are clipped at full scale
        clipped_ratio = np.mean(np.abs(samples) >= 0.999)
        if clipped_ratio > 0.02:
            return FrameDetection(
                frame_index=frame_index,
                timestamp_ms=timestamp_ms,
                detected_key=None,
                low_freq=None,
                high_freq=None,
                low_power=0.0,
                high_power=0.0,
                total_energy=float(np.mean(samples ** 2)),
                twist_db=None,
                second_harmonic_ratio=None,
                is_valid=False,
                rejection_reason="Audio clipping detected (>2% full-scale)",
            )

        # Remove DC Bias
        samples_zero_mean = samples - np.mean(samples)
        total_energy = float(np.mean(samples_zero_mean ** 2))

        # Check Silence / Minimum Energy
        if total_energy < self.energy_threshold:
            return FrameDetection(
                frame_index=frame_index,
                timestamp_ms=timestamp_ms,
                detected_key=None,
                low_freq=None,
                high_freq=None,
                low_power=0.0,
                high_power=0.0,
                total_energy=total_energy,
                twist_db=None,
                second_harmonic_ratio=None,
                is_valid=False,
                rejection_reason="Energy below silence threshold",
            )

        # Apply Hanning Window to minimize spectral leakage
        hanning_window = np.hanning(n_samples)
        windowed_samples = samples_zero_mean * hanning_window

        # Calculate Goertzel powers at all 8 DTMF frequencies
        low_powers = {f: goertzel_power(windowed_samples, f, sample_rate) for f in LOW_FREQUENCIES}
        high_powers = {f: goertzel_power(windowed_samples, f, sample_rate) for f in HIGH_FREQUENCIES}

        # Find strongest low and high group candidates
        sorted_low = sorted(low_powers.items(), key=lambda kv: kv[1], reverse=True)
        sorted_high = sorted(high_powers.items(), key=lambda kv: kv[1], reverse=True)

        best_low_freq, best_low_power = sorted_low[0]
        second_low_power = sorted_low[1][1]

        best_high_freq, best_high_power = sorted_high[0]
        second_high_power = sorted_high[1][1]

        # Minimum power threshold for DTMF candidates
        if best_low_power < self.energy_threshold or best_high_power < self.energy_threshold:
            return FrameDetection(
                frame_index=frame_index,
                timestamp_ms=timestamp_ms,
                detected_key=None,
                low_freq=best_low_freq,
                high_freq=best_high_freq,
                low_power=best_low_power,
                high_power=best_high_power,
                total_energy=total_energy,
                twist_db=None,
                second_harmonic_ratio=None,
                is_valid=False,
                rejection_reason="DTMF candidate power below threshold",
            )

        # Dominance check: best candidate must exceed runner-up in same group by >= 2.0x (~3 dB)
        low_dominance = best_low_power / (second_low_power + 1e-12)
        high_dominance = best_high_power / (second_high_power + 1e-12)

        if low_dominance < 1.8:
            return FrameDetection(
                frame_index=frame_index,
                timestamp_ms=timestamp_ms,
                detected_key=None,
                low_freq=best_low_freq,
                high_freq=best_high_freq,
                low_power=best_low_power,
                high_power=best_high_power,
                total_energy=total_energy,
                twist_db=None,
                second_harmonic_ratio=None,
                is_valid=False,
                rejection_reason=f"Ambiguous low frequency (dominance ratio {low_dominance:.2f} < 1.8)",
            )

        if high_dominance < 1.8:
            return FrameDetection(
                frame_index=frame_index,
                timestamp_ms=timestamp_ms,
                detected_key=None,
                low_freq=best_low_freq,
                high_freq=best_high_freq,
                low_power=best_low_power,
                high_power=best_high_power,
                total_energy=total_energy,
                twist_db=None,
                second_harmonic_ratio=None,
                is_valid=False,
                rejection_reason=f"Ambiguous high frequency (dominance ratio {high_dominance:.2f} < 1.8)",
            )

        # Twist calculation in dB: 10 * log10(high_power / low_power)
        twist_db = 10.0 * math.log10(best_high_power / (best_low_power + 1e-12))
        if twist_db < self.twist_min_db or twist_db > self.twist_max_db:
            return FrameDetection(
                frame_index=frame_index,
                timestamp_ms=timestamp_ms,
                detected_key=None,
                low_freq=best_low_freq,
                high_freq=best_high_freq,
                low_power=best_low_power,
                high_power=best_high_power,
                total_energy=total_energy,
                twist_db=twist_db,
                second_harmonic_ratio=None,
                is_valid=False,
                rejection_reason=f"Twist {twist_db:.2f} dB outside spec [{self.twist_min_db}, {self.twist_max_db}] dB",
            )

        # Second Harmonic Energy Check
        low_2nd_harmonic = 2.0 * best_low_freq
        high_2nd_harmonic = 2.0 * best_high_freq

        # Only check harmonic if below Nyquist
        low_harm_ratio = 0.0
        high_harm_ratio = 0.0

        if low_2nd_harmonic < (sample_rate / 2.0):
            p_harm_low = goertzel_power(windowed_samples, low_2nd_harmonic, sample_rate)
            low_harm_ratio = p_harm_low / (best_low_power + 1e-12)

        if high_2nd_harmonic < (sample_rate / 2.0):
            p_harm_high = goertzel_power(windowed_samples, high_2nd_harmonic, sample_rate)
            high_harm_ratio = p_harm_high / (best_high_power + 1e-12)

        max_harm_ratio = max(low_harm_ratio, high_harm_ratio)
        if max_harm_ratio > self.second_harmonic_max_ratio:
            return FrameDetection(
                frame_index=frame_index,
                timestamp_ms=timestamp_ms,
                detected_key=None,
                low_freq=best_low_freq,
                high_freq=best_high_freq,
                low_power=best_low_power,
                high_power=best_high_power,
                total_energy=total_energy,
                twist_db=twist_db,
                second_harmonic_ratio=max_harm_ratio,
                is_valid=False,
                rejection_reason=f"Second harmonic distortion {max_harm_ratio:.2f} > {self.second_harmonic_max_ratio}",
            )

        # Match keypad key
        detected_key = DTMF_MAP.get((best_low_freq, best_high_freq))
        if not detected_key:
            return FrameDetection(
                frame_index=frame_index,
                timestamp_ms=timestamp_ms,
                detected_key=None,
                low_freq=best_low_freq,
                high_freq=best_high_freq,
                low_power=best_low_power,
                high_power=best_high_power,
                total_energy=total_energy,
                twist_db=twist_db,
                second_harmonic_ratio=max_harm_ratio,
                is_valid=False,
                rejection_reason="Candidate frequencies did not map to keypad",
            )

        return FrameDetection(
            frame_index=frame_index,
            timestamp_ms=timestamp_ms,
            detected_key=detected_key,
            low_freq=best_low_freq,
            high_freq=best_high_freq,
            low_power=best_low_power,
            high_power=best_high_power,
            total_energy=total_energy,
            twist_db=twist_db,
            second_harmonic_ratio=max_harm_ratio,
            is_valid=True,
            rejection_reason=None,
        )


@dataclass
class ToneEvent:
    """Emitted distinct DTMF key event with timing metrics."""
    key: str
    onset_ms: float
    duration_ms: float
    offset_ms: float


class DTMFStreamingDecoder:
    """Streaming state machine maintaining debouncing, duration thresholds, and packet protocol."""

    def __init__(
        self,
        engine: Optional[GoertzelDTMFEngine] = None,
        min_tone_duration_ms: float = settings.DSP_MIN_TONE_DURATION_MS,
        min_silence_duration_ms: float = settings.DSP_MIN_SILENCE_DURATION_MS,
        frame_step_ms: float = 20.0,
    ):
        self.engine = engine or GoertzelDTMFEngine()
        self.min_tone_duration_ms = min_tone_duration_ms
        self.min_silence_duration_ms = min_silence_duration_ms
        self.frame_step_ms = frame_step_ms

        # State tracking
        self.current_candidate_key: Optional[str] = None
        self.candidate_start_ms: float = 0.0
        self.candidate_duration_ms: float = 0.0

        self.last_emitted_key: Optional[str] = None
        self.active_tone_emitted: bool = False

        self.silence_start_ms: Optional[float] = None
        self.silence_duration_ms: float = 0.0

        # Output collections
        self.emitted_events: List[ToneEvent] = []
        self.emitted_keys: List[str] = []
        self.packets: List[str] = []
        self._current_packet_buffer: List[str] = []
        self._in_packet: bool = False

    def process_frame(self, detection: FrameDetection) -> Optional[ToneEvent]:
        """Process consecutive frame detection through the state machine.
        
        Returns ToneEvent when a new distinct key is confirmed.
        """
        now_ms = detection.timestamp_ms
        new_event: Optional[ToneEvent] = None

        if detection.is_valid and detection.detected_key is not None:
            # Active tone detected
            key = detection.detected_key
            self.silence_start_ms = None
            self.silence_duration_ms = 0.0

            if key == self.current_candidate_key:
                self.candidate_duration_ms += self.frame_step_ms
            else:
                # Key transition
                self.current_candidate_key = key
                self.candidate_start_ms = now_ms
                self.candidate_duration_ms = self.frame_step_ms
                self.active_tone_emitted = False

            # Check if duration satisfied and not yet emitted for this pulse
            if self.candidate_duration_ms >= self.min_tone_duration_ms and not self.active_tone_emitted:
                event = ToneEvent(
                    key=key,
                    onset_ms=self.candidate_start_ms,
                    duration_ms=self.candidate_duration_ms,
                    offset_ms=now_ms + self.frame_step_ms,
                )
                self.emitted_events.append(event)
                self.emitted_keys.append(key)
                self.active_tone_emitted = True
                self.last_emitted_key = key
                new_event = event

                # Handle Packet Protocol: * start, # end
                if key == "*":
                    self._in_packet = True
                    self._current_packet_buffer = []
                elif key == "#":
                    if self._in_packet and self._current_packet_buffer:
                        self.packets.append("".join(self._current_packet_buffer))
                    self._in_packet = False
                    self._current_packet_buffer = []
                elif self._in_packet:
                    self._current_packet_buffer.append(key)

        else:
            # Silence / Invalid tone
            if self.silence_start_ms is None:
                self.silence_start_ms = now_ms
            self.silence_duration_ms += self.frame_step_ms

            if self.silence_duration_ms >= self.min_silence_duration_ms:
                # Reset candidate after confirmed silence gap
                self.current_candidate_key = None
                self.candidate_duration_ms = 0.0
                self.active_tone_emitted = False

        return new_event

    def check_hash_five_confirmation(self) -> bool:
        """Verify whether an acoustic sequence contains a distinct '#5' confirmation.
        
        Requires '#' followed by '5' as two distinct events.
        """
        keys = [ev.key for ev in self.emitted_events]
        for i in range(len(keys) - 1):
            if keys[i] == "#" and keys[i + 1] == "5":
                # Ensure timing separation between '#' offset and '5' onset
                gap = self.emitted_events[i + 1].onset_ms - self.emitted_events[i].offset_ms
                if gap >= -5.0:  # Allow minimal or standard inter-digit gap
                    return True
        return False


def decode_audio_stream(
    raw_samples: np.ndarray,
    sample_rate: int,
    frame_size_ms: float = 25.0,
    frame_step_ms: float = 12.5,
) -> Tuple[str, List[str], bool, List[FrameDetection]]:
    """Decode a full audio sample buffer through the Goertzel engine and state machine.
    
    Returns:
      (detected_key_sequence, packets, confirmation_detected, frame_detections)
    """
    engine = GoertzelDTMFEngine()
    decoder = DTMFStreamingDecoder(engine=engine, frame_step_ms=frame_step_ms)

    samples_per_frame = int(sample_rate * (frame_size_ms / 1000.0))
    samples_per_step = int(sample_rate * (frame_step_ms / 1000.0))

    detections: List[FrameDetection] = []
    total_samples = len(raw_samples)
    frame_idx = 0
    start = 0

    while start + samples_per_frame <= total_samples:
        frame = raw_samples[start : start + samples_per_frame]
        t_ms = (start / float(sample_rate)) * 1000.0
        det = engine.analyze_frame(frame, sample_rate, frame_index=frame_idx, timestamp_ms=t_ms)
        detections.append(det)
        decoder.process_frame(det)

        start += samples_per_step
        frame_idx += 1

    keys_str = "".join(decoder.emitted_keys)
    is_confirmed = decoder.check_hash_five_confirmation()
    return keys_str, decoder.packets, is_confirmed, detections


def parse_audio_payload(
    audio_bytes: bytes,
    audio_format: str,
    sample_rate: int,
) -> Tuple[np.ndarray, int]:
    """Parse raw bytes in supported formats (wav, pcm_s16le, pcm_f32le, mulaw) into float32 samples [-1.0, 1.0]."""
    format_lower = audio_format.lower().strip()

    if format_lower == "wav":
        with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
            wav_rate = wf.getframerate()
            n_channels = wf.getnchannels()
            sampwidth = wf.getsampwidth()
            frames = wf.readframes(wf.getnframes())

            if sampwidth == 2:
                samples = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
            elif sampwidth == 4:
                samples = np.frombuffer(frames, dtype=np.float32)
            elif sampwidth == 1:
                samples = (np.frombuffer(frames, dtype=np.uint8).astype(np.float32) - 128.0) / 128.0
            else:
                raise ValueError(f"Unsupported WAV sample width: {sampwidth} bytes")

            if n_channels > 1:
                samples = samples[::n_channels]  # Downmix to first channel
            return samples, wav_rate

    elif format_lower in ("pcm_s16le", "pcm"):
        samples = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        return samples, sample_rate

    elif format_lower in ("pcm_f32le", "f32"):
        samples = np.frombuffer(audio_bytes, dtype=np.float32)
        return samples, sample_rate

    elif format_lower in ("mulaw", "pcmu", "g711u"):
        samples = decode_mulaw(audio_bytes)
        return samples, sample_rate

    else:
        raise ValueError(f"Unknown audio format: {audio_format}")


def generate_dtmf_tone(
    key: str,
    duration_ms: float = 60.0,
    sample_rate: int = 8000,
    amplitude: float = 0.5,
    twist_db: float = 0.0,
) -> np.ndarray:
    """Synthesize clean DTMF dual-tone sinusoid array for tests and verification."""
    if key not in KEY_TO_FREQ:
        raise ValueError(f"Invalid DTMF key: '{key}'")

    low_f, high_f = KEY_TO_FREQ[key]
    n_samples = int(sample_rate * (duration_ms / 1000.0))
    t = np.arange(n_samples) / float(sample_rate)

    # Twist: 10^(twist_db / 20)
    high_gain = 10.0 ** (twist_db / 20.0)
    low_wave = np.sin(2.0 * np.pi * low_f * t)
    high_wave = np.sin(2.0 * np.pi * high_f * t) * high_gain

    combined = (low_wave + high_wave) / (1.0 + high_gain)
    return (combined * amplitude).astype(np.float32)


def generate_dtmf_sequence(
    sequence: str,
    tone_duration_ms: float = 60.0,
    silence_duration_ms: float = 50.0,
    sample_rate: int = 8000,
    amplitude: float = 0.5,
) -> np.ndarray:
    """Generate audio signal containing a sequence of DTMF digits with silence gaps."""
    silence_samples = np.zeros(int(sample_rate * (silence_duration_ms / 1000.0)), dtype=np.float32)
    chunks = []
    for char in sequence:
        if char in KEY_TO_FREQ:
            chunks.append(generate_dtmf_tone(char, tone_duration_ms, sample_rate, amplitude))
            chunks.append(silence_samples)
    if not chunks:
        return np.zeros(0, dtype=np.float32)
    return np.concatenate(chunks)
