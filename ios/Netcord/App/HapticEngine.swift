import UIKit
import CoreHaptics

/// The feel of the racket. Every strike is a sharp transient whose strength and
/// crispness come from the game (clean, hard hits are heavy and sharp, mishits are
/// soft and dull). A perfect strike adds a short decaying tail, like strings ringing.
/// Falls back to UIImpactFeedbackGenerator on devices without Core Haptics.
@MainActor
final class HapticEngine {

    private var engine: CHHapticEngine?
    private let fallback = UIImpactFeedbackGenerator(style: .rigid)
    private let notifier = UINotificationFeedbackGenerator()

    init() {
        fallback.prepare()
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else { return }
        do {
            let e = try CHHapticEngine()
            e.playsHapticsOnly = true
            e.isAutoShutdownEnabled = true
            e.resetHandler = { [weak e] in try? e?.start() }
            try e.start()
            engine = e
        } catch {
            engine = nil
        }
    }

    func play(intensity: Float, sharpness: Float, tail: Double) {
        let i = max(0, min(1, intensity)), s = max(0, min(1, sharpness))
        guard let engine = engine else {
            fallback.impactOccurred(intensity: CGFloat(i))
            fallback.prepare()
            return
        }
        var events = [CHHapticEvent(eventType: .hapticTransient, parameters: [
            CHHapticEventParameter(parameterID: .hapticIntensity, value: i),
            CHHapticEventParameter(parameterID: .hapticSharpness, value: s)
        ], relativeTime: 0)]
        var curves: [CHHapticParameterCurve] = []
        if tail > 0 {
            events.append(CHHapticEvent(eventType: .hapticContinuous, parameters: [
                CHHapticEventParameter(parameterID: .hapticIntensity, value: i * 0.5),
                CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.35)
            ], relativeTime: 0.01, duration: tail))
            curves.append(CHHapticParameterCurve(parameterID: .hapticIntensityControl, controlPoints: [
                CHHapticParameterCurve.ControlPoint(relativeTime: 0.01, value: 1),
                CHHapticParameterCurve.ControlPoint(relativeTime: 0.01 + tail, value: 0)
            ], relativeTime: 0))
        }
        do {
            let pattern = try CHHapticPattern(events: events, parameterCurves: curves)
            let player = try engine.makePlayer(with: pattern)
            try engine.start()
            try player.start(atTime: CHHapticTimeImmediate)
        } catch {
            fallback.impactOccurred(intensity: CGFloat(i))
        }
    }

    func notify(_ kind: String) {
        switch kind {
        case "success": notifier.notificationOccurred(.success)
        case "warning": notifier.notificationOccurred(.warning)
        case "error": notifier.notificationOccurred(.error)
        default: break
        }
    }
}
