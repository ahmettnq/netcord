import UIKit
import WebKit
import AVFoundation

/// Hosts the game (Resources/www/index.html) in a full-screen WKWebView and
/// provides three small native bridges the page uses when it runs inside the app:
///
///   window.webkit.messageHandlers.haptic.postMessage({ i, s, d })  Core Haptics strike
///   window.webkit.messageHandlers.haptic.postMessage({ n: "success" })  notification tap
///   window.webkit.messageHandlers.save.postMessage(jsonString)      keep the save in UserDefaults
///   window.webkit.messageHandlers.speak.postMessage(text)           chair umpire voice
///
/// The saved game is injected back as `window.__NATIVE_SAVE` before the page loads,
/// so progress survives even if the web view's own storage is cleared.
final class GameViewController: UIViewController, WKScriptMessageHandler, WKNavigationDelegate {

    private var webView: WKWebView!
    private let haptics = HapticEngine()
    private let speech = AVSpeechSynthesizer()
    private let saveKey = "netcord.save"

    override func loadView() {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        let content = WKUserContentController()
        let saved = UserDefaults.standard.string(forKey: saveKey) ?? ""
        let boot = "window.__NATIVE_SAVE = \(Self.jsString(saved)); window.__NATIVE_PLATFORM = 'ios';"
        content.addUserScript(WKUserScript(source: boot, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let proxy = WeakScriptHandler(self)
        for name in ["haptic", "save", "speak"] { content.add(proxy, name: name) }
        config.userContentController = content

        webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = true
        webView.backgroundColor = UIColor(named: "LaunchBackground")
        webView.scrollView.backgroundColor = webView.backgroundColor
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.minimumZoomScale = 1
        webView.scrollView.maximumZoomScale = 1
        webView.scrollView.pinchGestureRecognizer?.isEnabled = false
        webView.navigationDelegate = self
        webView.allowsLinkPreview = false
        view = webView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        loadGame()
        // Locking the phone or a phone call stops the audio session; restart it
        // when the app is back in front and let the page wake its audio engine.
        let nc = NotificationCenter.default
        nc.addObserver(self, selector: #selector(appBecameActive), name: UIApplication.didBecomeActiveNotification, object: nil)
        nc.addObserver(self, selector: #selector(audioInterrupted(_:)), name: AVAudioSession.interruptionNotification, object: AVAudioSession.sharedInstance())
    }

    @objc private func appBecameActive() { reviveAudio() }

    @objc private func audioInterrupted(_ note: Notification) {
        guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              AVAudioSession.InterruptionType(rawValue: raw) == .ended else { return }
        reviveAudio()
    }

    private func reviveAudio() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.ambient, mode: .default, options: [.mixWithOthers])
        try? session.setActive(true)
        webView?.evaluateJavaScript("window.__netcordForeground && window.__netcordForeground()", completionHandler: nil)
    }

    private func loadGame() {
        guard let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "www") else {
            assertionFailure("www/index.html missing from the app bundle")
            return
        }
        webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
    }

    // MARK: - Full-screen game presentation

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { .all }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .landscape }

    // MARK: - Bridges from the page

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        switch message.name {
        case "haptic":
            guard let body = message.body as? [String: Any] else { return }
            if let kind = body["n"] as? String {
                haptics.notify(kind)
            } else {
                let i = (body["i"] as? NSNumber)?.floatValue ?? 0.5
                let s = (body["s"] as? NSNumber)?.floatValue ?? 0.5
                let d = (body["d"] as? NSNumber)?.doubleValue ?? 0
                haptics.play(intensity: i, sharpness: s, tail: d)
            }
        case "save":
            if let json = message.body as? String { UserDefaults.standard.set(json, forKey: saveKey) }
        case "speak":
            guard let text = message.body as? String, !text.isEmpty else { return }
            if speech.isSpeaking { speech.stopSpeaking(at: .immediate) }
            let u = AVSpeechUtterance(string: text)
            u.voice = AVSpeechSynthesisVoice(language: "en-GB")
            u.rate = 0.5
            u.pitchMultiplier = 0.92
            u.volume = 0.85
            speech.speak(u)
        default:
            break
        }
    }

    // If iOS ever reclaims the web content process (low memory), bring the game back.
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        loadGame()
    }

    // Keep the game self-contained: never navigate away from the bundled page.
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        decisionHandler(navigationAction.request.url?.isFileURL == true ? .allow : .cancel)
    }

    /// Encodes a Swift string as a JavaScript string literal.
    private static func jsString(_ s: String) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: [s]),
              let arr = String(data: data, encoding: .utf8) else { return "\"\"" }
        return String(arr.dropFirst().dropLast())
    }
}

/// Avoids the retain cycle between WKUserContentController and the view controller.
private final class WeakScriptHandler: NSObject, WKScriptMessageHandler {
    private weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) {
        target?.userContentController(c, didReceive: m)
    }
}
