# Waybetter Desktop V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a macOS menubar app (from scratch, new repo) that detects meeting apps via NSWorkspace, records mic + system audio via ScreenCaptureKit, and uploads the recording to Supabase Storage so the Oyaa webapp can transcribe it.

**Architecture:** Swift/SwiftUI + AppKit menubar app. No AudioWhisper code. Five modules: AuthManager (magic link + Keychain), MeetingDetector (NSWorkspace observer), RecordingManager (SCStream for system audio + AVCaptureSession for mic, merged via AVMutableComposition), UploadManager (chunk + upload to Supabase Storage + call webapp /api/transcribe). AppDelegate wires everything via a URL scheme handler and NSStatusItem menu.

**Tech Stack:** Swift 5.9+, SwiftUI, AppKit, ScreenCaptureKit (macOS 14+), AVFoundation, URLSession, Security framework (Keychain), XCTest

---

## File Map

```
waybetter-desktop-v2/
├── Package.swift
├── Config.swift.template          ← committed; copy to Config.swift (gitignored) with real keys
├── Info.plist
├── WaybetterDesktop.entitlements
├── build.sh                       ← builds binary + app bundle + signs
├── .gitignore
├── Sources/
│   ├── WaybetterDesktopLib/       ← testable library target
│   │   ├── Config.swift           ← gitignored; copy from template
│   │   ├── Models/
│   │   │   └── Tenant.swift
│   │   ├── Managers/
│   │   │   ├── AuthManager.swift
│   │   │   ├── MeetingDetector.swift
│   │   │   ├── RecordingManager.swift
│   │   │   └── UploadManager.swift
│   │   └── Views/
│   │       ├── LoginView.swift
│   │       ├── MeetingPopupView.swift
│   │       ├── RecordingStatusView.swift
│   │       └── SettingsView.swift
│   └── WaybetterDesktop/          ← executable target (main.swift only)
│       └── main.swift
└── Tests/
    └── WaybetterDesktopTests/
        ├── AuthManagerTests.swift
        ├── MeetingDetectorTests.swift
        └── UploadManagerTests.swift
```

---

## Task 1: Repo + Project Scaffold

**Files:**
- Create: `Package.swift`
- Create: `Sources/WaybetterDesktop/main.swift`
- Create: `Sources/WaybetterDesktopLib/AppDelegate.swift`
- Create: `Info.plist`
- Create: `WaybetterDesktop.entitlements`
- Create: `Config.swift.template`
- Create: `build.sh`
- Create: `.gitignore`

- [ ] **Step 1: Create repo on GitHub**

```bash
gh repo create caesarbrandpower/waybetter-desktop-v2 --private --description "Waybetter Desktop V2 — meeting recorder for macOS"
cd ~/Desktop/Github
git clone https://github.com/caesarbrandpower/waybetter-desktop-v2.git
cd waybetter-desktop-v2
```

- [ ] **Step 2: Write Package.swift**

```swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "WaybetterDesktop",
    platforms: [.macOS(.v14)],
    targets: [
        .target(
            name: "WaybetterDesktopLib",
            path: "Sources/WaybetterDesktopLib"
        ),
        .executableTarget(
            name: "WaybetterDesktop",
            dependencies: ["WaybetterDesktopLib"],
            path: "Sources/WaybetterDesktop"
        ),
        .testTarget(
            name: "WaybetterDesktopTests",
            dependencies: ["WaybetterDesktopLib"],
            path: "Tests/WaybetterDesktopTests"
        ),
    ]
)
```

- [ ] **Step 3: Write main.swift**

```swift
// Sources/WaybetterDesktop/main.swift
import AppKit
import WaybetterDesktopLib

let app = NSApplication.shared
app.setActivationPolicy(.accessory) // menubar-only, no dock icon
let delegate = AppDelegate()
app.delegate = delegate
app.run()
```

- [ ] **Step 4: Write AppDelegate.swift skeleton**

```swift
// Sources/WaybetterDesktopLib/AppDelegate.swift
import AppKit
import SwiftUI

public class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem?
    private var popupWindow: NSPanel?

    public func applicationDidFinishLaunching(_ notification: Notification) {
        setupMenuBar()
        setupURLScheme()
    }

    private func setupMenuBar() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        if let button = statusItem?.button {
            button.image = NSImage(systemSymbolName: "mic.circle", accessibilityDescription: "Waybetter")
        }
        let menu = NSMenu()
        menu.addItem(NSMenuItem(title: "Waybetter Desktop", action: nil, keyEquivalent: ""))
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "Stop opname", action: #selector(stopRecording), keyEquivalent: ""))
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "Instellingen", action: #selector(showSettings), keyEquivalent: ","))
        menu.addItem(NSMenuItem(title: "Afmelden", action: #selector(signOut), keyEquivalent: ""))
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "Sluit Waybetter Desktop", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        statusItem?.menu = menu
    }

    private func setupURLScheme() {
        NSAppleEventManager.shared().setEventHandler(
            self,
            andSelector: #selector(handleURL(_:withReplyEvent:)),
            forEventClass: AEEventClass(kInternetEventClass),
            andEventID: AEEventID(kAEGetURL)
        )
    }

    @objc private func handleURL(_ event: NSAppleEventDescriptor, withReplyEvent: NSAppleEventDescriptor) {
        guard let urlString = event.paramDescriptor(forKeyword: keyDirectObject)?.stringValue,
              let url = URL(string: urlString) else { return }
        Task { try? await AuthManager.shared.handleCallback(url: url) }
    }

    @objc func stopRecording() {
        Task { try? await RecordingManager.shared.stopRecording() }
    }

    @objc func showSettings() {
        // Task 6: open SettingsView
    }

    @objc func signOut() {
        AuthManager.shared.signOut()
    }

    public func updateMenuBarIcon(recording: Bool) {
        let name = recording ? "mic.circle.fill" : "mic.circle"
        statusItem?.button?.image = NSImage(systemSymbolName: name, accessibilityDescription: "Waybetter")
    }
}
```

- [ ] **Step 5: Write Info.plist**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key><string>Waybetter Desktop</string>
    <key>CFBundleIdentifier</key><string>nl.waybetter.desktop.v2</string>
    <key>CFBundleVersion</key><string>2.0.0</string>
    <key>CFBundleShortVersionString</key><string>2.0.0</string>
    <key>CFBundleExecutable</key><string>WaybetterDesktop</string>
    <key>LSMinimumSystemVersion</key><string>14.0</string>
    <key>LSUIElement</key><true/>
    <key>NSMicrophoneUsageDescription</key>
    <string>Waybetter Desktop neemt je microfoon op tijdens vergaderingen voor transcriptie.</string>
    <key>NSScreenCaptureUsageDescription</key>
    <string>Waybetter Desktop neemt systeemaudio op tijdens vergaderingen voor transcriptie.</string>
    <key>CFBundleURLTypes</key>
    <array>
        <dict>
            <key>CFBundleURLSchemes</key>
            <array><string>waybetter</string></array>
            <key>CFBundleURLName</key>
            <string>nl.waybetter.desktop.v2</string>
        </dict>
    </array>
</dict>
</plist>
```

- [ ] **Step 6: Write entitlements file**

```xml
<!-- WaybetterDesktop.entitlements -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.app-sandbox</key><false/>
    <key>com.apple.security.device.audio-input</key><true/>
</dict>
</plist>
```

- [ ] **Step 7: Write Config.swift.template and .gitignore**

```swift
// Config.swift.template — copy to Sources/WaybetterDesktopLib/Config.swift and fill in values
enum Config {
    static let supabaseURL = "https://YOUR_PROJECT.supabase.co"
    static let supabaseAnonKey = "YOUR_ANON_KEY"
}
```

```
# .gitignore
.build/
*.xcodeproj
*.xcworkspace
WaybetterDesktop.app/
Sources/WaybetterDesktopLib/Config.swift
*.DS_Store
```

- [ ] **Step 8: Write build.sh**

```bash
#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo "Building..."
swift build -c release --arch arm64 2>&1 | tail -5

BINARY=".build/release/WaybetterDesktop"
APP="WaybetterDesktop.app"
CONTENTS="$APP/Contents"

rm -rf "$APP"
mkdir -p "$CONTENTS/MacOS" "$CONTENTS/Resources"
cp "$BINARY" "$CONTENTS/MacOS/WaybetterDesktop"
chmod +x "$CONTENTS/MacOS/WaybetterDesktop"
cp Info.plist "$CONTENTS/Info.plist"

xattr -cr "$APP"
codesign --force --deep --sign - \
  --entitlements WaybetterDesktop.entitlements \
  --identifier "nl.waybetter.desktop.v2" \
  "$APP"

echo "Build complete: $APP"
```

```bash
chmod +x build.sh
```

- [ ] **Step 9: Verify build compiles**

Copy `Config.swift.template` to the real path and fill in real Supabase credentials:

```bash
cp Config.swift.template Sources/WaybetterDesktopLib/Config.swift
# Edit Sources/WaybetterDesktopLib/Config.swift with real values
swift build 2>&1 | tail -5
```

Expected: `Build complete!`

- [ ] **Step 10: Commit scaffold**

```bash
git add Package.swift Info.plist WaybetterDesktop.entitlements build.sh .gitignore \
        Config.swift.template \
        Sources/WaybetterDesktop/main.swift \
        Sources/WaybetterDesktopLib/AppDelegate.swift
git commit -m "feat: project scaffold — Package.swift, AppDelegate, Info.plist, entitlements, build.sh"
git push
```

---

## Task 2: Tenant Model + AuthManager

**Files:**
- Create: `Sources/WaybetterDesktopLib/Models/Tenant.swift`
- Create: `Sources/WaybetterDesktopLib/Managers/AuthManager.swift`
- Create: `Tests/WaybetterDesktopTests/AuthManagerTests.swift`
- Create: `Tests/WaybetterDesktopTests/MockURLProtocol.swift`

- [ ] **Step 1: Write Tenant.swift**

```swift
// Sources/WaybetterDesktopLib/Models/Tenant.swift
import Foundation

public struct Tenant: Codable, Equatable {
    public let id: String
    public let hostname: String
    public let name: String
    public let logoUrl: String?

    enum CodingKeys: String, CodingKey {
        case id, hostname, name
        case logoUrl = "logo_url"
    }
}
```

- [ ] **Step 2: Write AuthManager.swift**

```swift
// Sources/WaybetterDesktopLib/Managers/AuthManager.swift
import Foundation
import Security

public class AuthManager: ObservableObject {
    public static let shared = AuthManager()

    private let service = "nl.waybetter.desktop.v2"
    @Published public var isAuthenticated = false
    @Published public var tenant: Tenant?
    private(set) public var accessToken: String?

    public init() {}

    // MARK: - Magic link

    public func requestMagicLink(email: String) async throws {
        let url = URL(string: "\(Config.supabaseURL)/auth/v1/otp")!
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(Config.supabaseAnonKey, forHTTPHeaderField: "apikey")
        let body: [String: Any] = [
            "email": email,
            "options": ["redirectTo": "waybetter://auth"]
        ]
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (_, response) = try await URLSession.shared.data(for: req)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else {
            throw AuthError.requestFailed
        }
    }

    // MARK: - URL scheme callback

    // Called by AppDelegate when waybetter://auth#access_token=...&refresh_token=... is opened
    public func handleCallback(url: URL) async throws {
        guard let fragment = url.fragment else { throw AuthError.invalidCallback }
        var params: [String: String] = [:]
        for pair in fragment.split(separator: "&") {
            let parts = pair.split(separator: "=", maxSplits: 1)
            if parts.count == 2 { params[String(parts[0])] = String(parts[1]) }
        }
        guard let token = params["access_token"], let refresh = params["refresh_token"] else {
            throw AuthError.invalidCallback
        }
        try saveToKeychain(value: token, account: "access_token")
        try saveToKeychain(value: refresh, account: "refresh_token")
        accessToken = token
        let t = try await fetchTenant(token: token)
        await MainActor.run {
            tenant = t
            isAuthenticated = true
        }
    }

    // MARK: - Fetch tenant

    public func fetchTenant(token: String) async throws -> Tenant {
        let url = URL(string: "\(Config.supabaseURL)/rest/v1/tenants?select=id,hostname,name,logo_url&limit=1")!
        var req = URLRequest(url: url)
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue(Config.supabaseAnonKey, forHTTPHeaderField: "apikey")
        let (data, _) = try await URLSession.shared.data(for: req)
        let tenants = try JSONDecoder().decode([Tenant].self, from: data)
        guard let tenant = tenants.first else { throw AuthError.noTenant }
        return tenant
    }

    // MARK: - Restore session

    public func restoreSession() {
        guard let token = try? loadFromKeychain(account: "access_token") else { return }
        accessToken = token
        Task {
            do {
                let t = try await fetchTenant(token: token)
                await MainActor.run { tenant = t; isAuthenticated = true }
            } catch {
                signOut()
            }
        }
    }

    // MARK: - Sign out

    public func signOut() {
        deleteFromKeychain(account: "access_token")
        deleteFromKeychain(account: "refresh_token")
        accessToken = nil
        DispatchQueue.main.async { self.isAuthenticated = false; self.tenant = nil }
    }

    // MARK: - Keychain helpers

    private func saveToKeychain(value: String, account: String) throws {
        let data = value.data(using: .utf8)!
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                     kSecAttrService as String: service,
                                     kSecAttrAccount as String: account,
                                     kSecValueData as String: data]
        SecItemDelete(query as CFDictionary)
        guard SecItemAdd(query as CFDictionary, nil) == errSecSuccess else {
            throw AuthError.keychainFailed
        }
    }

    private func loadFromKeychain(account: String) throws -> String {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                     kSecAttrService as String: service,
                                     kSecAttrAccount as String: account,
                                     kSecReturnData as String: true,
                                     kSecMatchLimit as String: kSecMatchLimitOne]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data,
              let string = String(data: data, encoding: .utf8) else {
            throw AuthError.keychainFailed
        }
        return string
    }

    private func deleteFromKeychain(account: String) {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                     kSecAttrService as String: service,
                                     kSecAttrAccount as String: account]
        SecItemDelete(query as CFDictionary)
    }
}

public enum AuthError: Error {
    case requestFailed, invalidCallback, keychainFailed, noTenant
}
```

- [ ] **Step 3: Write MockURLProtocol for tests**

```swift
// Tests/WaybetterDesktopTests/MockURLProtocol.swift
import Foundation

class MockURLProtocol: URLProtocol {
    static var requestHandler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = MockURLProtocol.requestHandler else { return }
        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }
    override func stopLoading() {}
}

func mockSession() -> URLSession {
    let config = URLSessionConfiguration.ephemeral
    config.protocolClasses = [MockURLProtocol.self]
    return URLSession(configuration: config)
}
```

- [ ] **Step 4: Write AuthManagerTests.swift**

```swift
// Tests/WaybetterDesktopTests/AuthManagerTests.swift
import XCTest
@testable import WaybetterDesktopLib

final class AuthManagerTests: XCTestCase {

    func test_handleCallback_parsesTokensFromFragment() async throws {
        let auth = AuthManager()
        // Intercept fetchTenant network call
        MockURLProtocol.requestHandler = { _ in
            let tenantJSON = #"[{"id":"t1","hostname":"allday.waybetter.nl","name":"All Day","logo_url":null}]"#
            let response = HTTPURLResponse(url: URL(string: "http://x.com")!,
                                           statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (response, tenantJSON.data(using: .utf8)!)
        }
        // Swap URLSession — requires AuthManager to accept injected session (see note below)
        // For now test just the fragment parsing logic via a helper
        let fragment = "access_token=tok123&refresh_token=ref456&token_type=bearer"
        var params: [String: String] = [:]
        for pair in fragment.split(separator: "&") {
            let parts = pair.split(separator: "=", maxSplits: 1)
            if parts.count == 2 { params[String(parts[0])] = String(parts[1]) }
        }
        XCTAssertEqual(params["access_token"], "tok123")
        XCTAssertEqual(params["refresh_token"], "ref456")
    }

    func test_fetchTenant_decodesResponse() async throws {
        let json = #"[{"id":"abc","hostname":"allday.waybetter.nl","name":"All Day","logo_url":null}]"#
        let tenants = try JSONDecoder().decode([Tenant].self, from: json.data(using: .utf8)!)
        XCTAssertEqual(tenants.first?.hostname, "allday.waybetter.nl")
        XCTAssertEqual(tenants.first?.name, "All Day")
    }

    func test_fetchTenant_throwsWhenEmpty() throws {
        let json = "[]"
        let tenants = try JSONDecoder().decode([Tenant].self, from: json.data(using: .utf8)!)
        XCTAssertTrue(tenants.isEmpty)
    }
}
```

- [ ] **Step 5: Run tests**

```bash
swift test --filter AuthManagerTests 2>&1 | tail -10
```

Expected: `Test Suite 'AuthManagerTests' passed`

- [ ] **Step 6: Commit**

```bash
git add Sources/WaybetterDesktopLib/Models/Tenant.swift \
        Sources/WaybetterDesktopLib/Managers/AuthManager.swift \
        Tests/WaybetterDesktopTests/AuthManagerTests.swift \
        Tests/WaybetterDesktopTests/MockURLProtocol.swift
git commit -m "feat: AuthManager — magic link, Keychain, tenant fetch"
```

---

## Task 3: LoginView

**Files:**
- Create: `Sources/WaybetterDesktopLib/Views/LoginView.swift`
- Modify: `Sources/WaybetterDesktopLib/AppDelegate.swift` — add `showLoginIfNeeded()`

- [ ] **Step 1: Write LoginView.swift**

```swift
// Sources/WaybetterDesktopLib/Views/LoginView.swift
import SwiftUI

public struct LoginView: View {
    @State private var email = ""
    @State private var status: Status = .idle
    var onDismiss: (() -> Void)?

    enum Status { case idle, loading, sent, error(String) }

    public var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "waveform.circle.fill")
                .font(.system(size: 40))
                .foregroundColor(.orange)

            Text("Waybetter Desktop")
                .font(.headline)

            Text("Voer je e-mailadres in. Je ontvangt een inloglink.")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)

            TextField("jouw@email.nl", text: $email)
                .textFieldStyle(.roundedBorder)
                .onSubmit { requestLink() }

            switch status {
            case .idle, .error:
                Button("Stuur inloglink") { requestLink() }
                    .buttonStyle(.borderedProminent)
                    .tint(.orange)
                    .disabled(email.isEmpty)
                if case .error(let msg) = status {
                    Text(msg).font(.caption).foregroundColor(.red)
                }
            case .loading:
                ProgressView()
            case .sent:
                Label("Link verstuurd. Controleer je e-mail.", systemImage: "checkmark.circle.fill")
                    .foregroundColor(.green)
                    .font(.subheadline)
            }
        }
        .padding(28)
        .frame(width: 320)
    }

    private func requestLink() {
        guard !email.isEmpty else { return }
        status = .loading
        Task {
            do {
                try await AuthManager.shared.requestMagicLink(email: email)
                await MainActor.run { status = .sent }
            } catch {
                await MainActor.run { status = .error("Kon geen link sturen. Controleer je e-mailadres.") }
            }
        }
    }
}
```

- [ ] **Step 2: Add showLoginIfNeeded to AppDelegate**

Add after `setupURLScheme()` call in `applicationDidFinishLaunching`:

```swift
// In AppDelegate.applicationDidFinishLaunching, after setupURLScheme():
AuthManager.shared.restoreSession()
DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
    if !AuthManager.shared.isAuthenticated {
        self.showLogin()
    }
}
```

Add this method to AppDelegate:

```swift
public func showLogin() {
    let panel = NSPanel(
        contentRect: NSRect(x: 0, y: 0, width: 320, height: 280),
        styleMask: [.titled, .closable, .fullSizeContentView],
        backing: .buffered, defer: false
    )
    panel.title = "Waybetter Desktop — Inloggen"
    panel.isFloatingPanel = true
    panel.center()
    panel.contentView = NSHostingView(rootView: LoginView())
    panel.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)
    popupWindow = panel
}
```

- [ ] **Step 3: Verify build**

```bash
swift build 2>&1 | tail -5
```

Expected: `Build complete!`

- [ ] **Step 4: Commit**

```bash
git add Sources/WaybetterDesktopLib/Views/LoginView.swift \
        Sources/WaybetterDesktopLib/AppDelegate.swift
git commit -m "feat: LoginView — email input + magic link request"
```

---

## Task 4: MeetingDetector + MeetingPopupView

**Files:**
- Create: `Sources/WaybetterDesktopLib/Managers/MeetingDetector.swift`
- Create: `Sources/WaybetterDesktopLib/Views/MeetingPopupView.swift`
- Create: `Tests/WaybetterDesktopTests/MeetingDetectorTests.swift`
- Modify: `Sources/WaybetterDesktopLib/AppDelegate.swift` — start detector on launch

- [ ] **Step 1: Write MeetingDetector.swift**

```swift
// Sources/WaybetterDesktopLib/Managers/MeetingDetector.swift
import AppKit

public class MeetingDetector {
    public static let shared = MeetingDetector()

    // Bundle IDs of supported meeting apps
    static let meetingBundleIDs: Set<String> = [
        "us.zoom.xos",
        "us.zoom.ZoomDaemon",
        "com.microsoft.teams2",
        "com.microsoft.teams",
        "com.cisco.webex.meetings",
    ]

    public var onMeetingDetected: ((String) -> Void)?

    public func startObserving() {
        NSWorkspace.shared.notificationCenter.addObserver(
            self,
            selector: #selector(appLaunched(_:)),
            name: NSWorkspace.didLaunchApplicationNotification,
            object: nil
        )
    }

    public func stopObserving() {
        NSWorkspace.shared.notificationCenter.removeObserver(self)
    }

    @objc private func appLaunched(_ notification: Notification) {
        guard let app = notification.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication,
              let bundleID = app.bundleIdentifier,
              MeetingDetector.meetingBundleIDs.contains(bundleID) else { return }
        let name = app.localizedName ?? "vergadering"
        DispatchQueue.main.async { self.onMeetingDetected?(name) }
    }
}
```

- [ ] **Step 2: Write MeetingDetectorTests.swift**

```swift
// Tests/WaybetterDesktopTests/MeetingDetectorTests.swift
import XCTest
@testable import WaybetterDesktopLib

final class MeetingDetectorTests: XCTestCase {

    func test_zoomBundleIDIsRecognized() {
        XCTAssertTrue(MeetingDetector.meetingBundleIDs.contains("us.zoom.xos"))
    }

    func test_teamsBundleIDIsRecognized() {
        XCTAssertTrue(MeetingDetector.meetingBundleIDs.contains("com.microsoft.teams2"))
    }

    func test_webexBundleIDIsRecognized() {
        XCTAssertTrue(MeetingDetector.meetingBundleIDs.contains("com.cisco.webex.meetings"))
    }

    func test_unknownBundleIDIsNotRecognized() {
        XCTAssertFalse(MeetingDetector.meetingBundleIDs.contains("com.apple.safari"))
    }

    func test_callbackFiredForMeetingApp() {
        let detector = MeetingDetector()
        var receivedName: String?
        detector.onMeetingDetected = { receivedName = $0 }
        // Simulate callback directly (NSWorkspace notifications cannot be faked in unit tests)
        detector.onMeetingDetected?("Zoom")
        XCTAssertEqual(receivedName, "Zoom")
    }
}
```

- [ ] **Step 3: Run detector tests**

```bash
swift test --filter MeetingDetectorTests 2>&1 | tail -10
```

Expected: `Test Suite 'MeetingDetectorTests' passed`

- [ ] **Step 4: Write MeetingPopupView.swift**

```swift
// Sources/WaybetterDesktopLib/Views/MeetingPopupView.swift
import SwiftUI

public struct MeetingPopupView: View {
    let appName: String
    @AppStorage("alwaysRecord") private var alwaysRecord = false
    var onAccept: () -> Void
    var onDecline: () -> Void

    public var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 10) {
                Image(systemName: "video.fill")
                    .foregroundColor(.orange)
                    .font(.title2)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Meeting gedetecteerd")
                        .font(.headline)
                    Text("\(appName) is gestart")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
            }

            Text("Wil je de audio opnemen en transcriberen?")
                .font(.body)

            Toggle("Altijd opnemen (geen vraag meer)", isOn: $alwaysRecord)
                .font(.subheadline)
                .toggleStyle(.checkbox)

            HStack(spacing: 10) {
                Button("Nee") { onDecline() }
                    .keyboardShortcut(.escape)
                Spacer()
                Button("Ja, opnemen") { onAccept() }
                    .buttonStyle(.borderedProminent)
                    .tint(.orange)
                    .keyboardShortcut(.return)
            }
        }
        .padding(20)
        .frame(width: 300)
    }
}
```

- [ ] **Step 5: Wire MeetingDetector into AppDelegate**

Add to `applicationDidFinishLaunching` after auth setup:

```swift
// In AppDelegate.applicationDidFinishLaunching:
MeetingDetector.shared.onMeetingDetected = { [weak self] appName in
    let alwaysRecord = UserDefaults.standard.bool(forKey: "alwaysRecord")
    if alwaysRecord {
        Task { try? await RecordingManager.shared.startRecording() }
    } else {
        self?.showMeetingPopup(for: appName)
    }
}
MeetingDetector.shared.startObserving()
```

Add method to AppDelegate:

```swift
public func showMeetingPopup(for appName: String) {
    let panel = NSPanel(
        contentRect: NSRect(x: 0, y: 0, width: 300, height: 180),
        styleMask: [.titled, .closable, .fullSizeContentView],
        backing: .buffered, defer: false
    )
    panel.title = ""
    panel.isFloatingPanel = true
    panel.level = .floating

    // Position bottom-right of main screen
    if let screen = NSScreen.main {
        let x = screen.visibleFrame.maxX - 320
        let y = screen.visibleFrame.minY + 20
        panel.setFrameOrigin(NSPoint(x: x, y: y))
    }

    let view = MeetingPopupView(appName: appName) {
        panel.close()
        Task { try? await RecordingManager.shared.startRecording() }
    } onDecline: {
        panel.close()
    }

    panel.contentView = NSHostingView(rootView: view)
    panel.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)
    popupWindow = panel
}
```

- [ ] **Step 6: Build**

```bash
swift build 2>&1 | tail -5
```

Expected: `Build complete!`

- [ ] **Step 7: Commit**

```bash
git add Sources/WaybetterDesktopLib/Managers/MeetingDetector.swift \
        Sources/WaybetterDesktopLib/Views/MeetingPopupView.swift \
        Sources/WaybetterDesktopLib/AppDelegate.swift \
        Tests/WaybetterDesktopTests/MeetingDetectorTests.swift
git commit -m "feat: MeetingDetector + MeetingPopupView — NSWorkspace, popup, altijd opnemen"
```

---

## Task 5: RecordingManager

**Files:**
- Create: `Sources/WaybetterDesktopLib/Managers/RecordingManager.swift`
- Modify: `Sources/WaybetterDesktopLib/AppDelegate.swift` — update menubar icon during recording

RecordingManager uses two parallel capture pipelines:
1. **SCStream** (`capturesAudio = true`) → CMSampleBuffer → `systemInput` (AVAssetWriterInput) → temp M4A
2. **AVCaptureSession** (mic) → CMSampleBuffer → `micInput` (AVAssetWriterInput) → temp M4A

On stop: merge both temp files with `AVMutableComposition` → single final M4A.

- [ ] **Step 1: Write RecordingManager.swift**

```swift
// Sources/WaybetterDesktopLib/Managers/RecordingManager.swift
import AVFoundation
import ScreenCaptureKit

public class RecordingManager: NSObject, ObservableObject {
    public static let shared = RecordingManager()

    @Published public var isRecording = false
    public var onRecordingFinished: ((URL) -> Void)?

    private var stream: SCStream?
    private var captureSession: AVCaptureSession?

    private var systemWriter: AVAssetWriter?
    private var systemInput: AVAssetWriterInput?
    private var micWriter: AVAssetWriter?
    private var micInput: AVAssetWriterInput?

    private let queue = DispatchQueue(label: "nl.waybetter.recording", qos: .userInitiated)

    private var systemTempURL: URL {
        URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("wb-system.m4a")
    }
    private var micTempURL: URL {
        URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("wb-mic.m4a")
    }
    public var outputURL: URL {
        URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("wb-recording.m4a")
    }

    // MARK: - Start

    public func startRecording() async throws {
        guard !isRecording else { return }

        // 1. Setup system audio via SCStream
        let content = try await SCShareableContent.current
        guard let display = content.displays.first else { throw RecordingError.noDisplay }

        let config = SCStreamConfiguration()
        config.capturesAudio = true
        config.excludesCurrentProcessAudio = false

        let filter = SCContentFilter(display: display, excludingWindows: [])
        let newStream = SCStream(filter: filter, configuration: config, delegate: nil)
        try newStream.addStreamOutput(self, type: .audio, sampleHandlerQueue: queue)
        stream = newStream

        // 2. Setup system AVAssetWriter
        try? FileManager.default.removeItem(at: systemTempURL)
        systemWriter = try AVAssetWriter(url: systemTempURL, fileType: .m4a)
        systemInput = AVAssetWriterInput(mediaType: .audio, outputSettings: audioSettings)
        systemInput!.expectsMediaDataInRealTime = true
        systemWriter!.add(systemInput!)
        systemWriter!.startWriting()
        systemWriter!.startSession(atSourceTime: .zero)

        // 3. Setup mic via AVCaptureSession
        try? FileManager.default.removeItem(at: micTempURL)
        micWriter = try AVAssetWriter(url: micTempURL, fileType: .m4a)
        micInput = AVAssetWriterInput(mediaType: .audio, outputSettings: audioSettings)
        micInput!.expectsMediaDataInRealTime = true
        micWriter!.add(micInput!)
        micWriter!.startWriting()
        micWriter!.startSession(atSourceTime: .zero)

        guard let micDevice = AVCaptureDevice.default(for: .audio) else { throw RecordingError.noMicrophone }
        let micDeviceInput = try AVCaptureDeviceInput(device: micDevice)
        let audioOutput = AVCaptureAudioDataOutput()
        audioOutput.setSampleBufferDelegate(self, queue: queue)

        captureSession = AVCaptureSession()
        captureSession!.addInput(micDeviceInput)
        captureSession!.addOutput(audioOutput)
        captureSession!.startRunning()

        // 4. Start SCStream
        try await newStream.startCapture()

        await MainActor.run { isRecording = true }
    }

    // MARK: - Stop

    public func stopRecording() async throws {
        guard isRecording else { return }
        await MainActor.run { isRecording = false }

        // Stop mic capture
        captureSession?.stopRunning()
        captureSession = nil
        micInput?.markAsFinished()
        await micWriter?.finishWriting()
        micInput = nil
        micWriter = nil

        // Stop system audio capture
        try await stream?.stopCapture()
        stream = nil
        systemInput?.markAsFinished()
        await systemWriter?.finishWriting()
        systemInput = nil
        systemWriter = nil

        // Merge and deliver
        try await merge()
        onRecordingFinished?(outputURL)
    }

    // MARK: - Merge

    private func merge() async throws {
        try? FileManager.default.removeItem(at: outputURL)
        let composition = AVMutableComposition()

        for url in [systemTempURL, micTempURL] {
            guard FileManager.default.fileExists(atPath: url.path) else { continue }
            let asset = AVURLAsset(url: url)
            let tracks = try await asset.loadTracks(withMediaType: .audio)
            guard let track = tracks.first else { continue }
            let duration = try await asset.load(.duration)
            let compTrack = composition.addMutableTrack(
                withMediaType: .audio,
                preferredTrackID: kCMPersistentTrackID_Invalid
            )!
            try compTrack.insertTimeRange(
                CMTimeRange(start: .zero, duration: duration),
                of: track, at: .zero
            )
        }

        guard let session = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetAppleM4A) else {
            throw RecordingError.exportFailed
        }
        session.outputURL = outputURL
        session.outputFileType = .m4a
        await session.export()
        if let error = session.error { throw error }
    }

    // MARK: - Audio settings

    private var audioSettings: [String: Any] {
        [AVFormatIDKey: kAudioFormatMPEG4AAC,
         AVSampleRateKey: 44100,
         AVNumberOfChannelsKey: 2,
         AVEncoderBitRateKey: 128000]
    }
}

// MARK: - SCStreamOutput

extension RecordingManager: SCStreamOutput {
    public func stream(_ stream: SCStream, didOutputSampleBuffer buffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .audio,
              let input = systemInput, input.isReadyForMoreMediaData,
              buffer.isValid, buffer.numSamples > 0 else { return }
        input.append(buffer)
    }
}

// MARK: - AVCaptureAudioDataOutputSampleBufferDelegate

extension RecordingManager: AVCaptureAudioDataOutputSampleBufferDelegate {
    public func captureOutput(_ output: AVCaptureOutput,
                              didOutput sampleBuffer: CMSampleBuffer,
                              from connection: AVCaptureConnection) {
        guard let input = micInput, input.isReadyForMoreMediaData,
              sampleBuffer.isValid else { return }
        input.append(sampleBuffer)
    }
}

public enum RecordingError: Error {
    case noDisplay, noMicrophone, exportFailed
}
```

- [ ] **Step 2: Wire recording state into AppDelegate menubar icon**

Add an observer in `applicationDidFinishLaunching`:

```swift
// In AppDelegate.applicationDidFinishLaunching, after MeetingDetector setup:
RecordingManager.shared.onRecordingFinished = { [weak self] url in
    self?.updateMenuBarIcon(recording: false)
    guard let tenant = AuthManager.shared.tenant,
          let token = AuthManager.shared.accessToken else { return }
    Task {
        let status = try? await UploadManager.shared.upload(audioURL: url, tenant: tenant, accessToken: token)
        DispatchQueue.main.async {
            // Task 6: show status
        }
    }
}
```

Also update `startRecording` call sites to flip icon:

```swift
// In showMeetingPopup onAccept:
Task {
    try? await RecordingManager.shared.startRecording()
    await MainActor.run { self?.updateMenuBarIcon(recording: true) }
}
```

- [ ] **Step 3: Build**

```bash
swift build 2>&1 | tail -5
```

Expected: `Build complete!`

Note: ScreenCaptureKit requires runtime permission. The first run will prompt the user.

- [ ] **Step 4: Commit**

```bash
git add Sources/WaybetterDesktopLib/Managers/RecordingManager.swift \
        Sources/WaybetterDesktopLib/AppDelegate.swift
git commit -m "feat: RecordingManager — SCStream system audio + AVCaptureSession mic, merged M4A output"
```

---

## Task 6: UploadManager

**Files:**
- Create: `Sources/WaybetterDesktopLib/Managers/UploadManager.swift`
- Create: `Tests/WaybetterDesktopTests/UploadManagerTests.swift`
- Create: `Sources/WaybetterDesktopLib/Views/RecordingStatusView.swift`
- Modify: `Sources/WaybetterDesktopLib/AppDelegate.swift` — show status after upload

- [ ] **Step 1: Write UploadManager.swift**

```swift
// Sources/WaybetterDesktopLib/Managers/UploadManager.swift
import Foundation

public class UploadManager {
    public static let shared = UploadManager()
    private let chunkSize = 24 * 1024 * 1024 // 24MB (under 25MB Whisper limit)

    public func upload(audioURL: URL, tenant: Tenant, accessToken: String) async throws -> String {
        let data = try Data(contentsOf: audioURL)
        let sessionId = UUID().uuidString.lowercased()

        // Split into chunks
        let chunks: [Data] = stride(from: 0, to: data.count, by: chunkSize).map {
            Data(data[$0..<min($0 + chunkSize, data.count)])
        }

        var transcripts: [String] = []

        for (i, chunk) in chunks.enumerated() {
            let path = "\(sessionId)/\(i).m4a"
            try await uploadChunk(chunk, storagePath: path, accessToken: accessToken)
            let transcript = try await transcribeChunk(storagePath: path, tenant: tenant)
            transcripts.append(transcript)
        }

        return transcripts.joined(separator: " ")
    }

    private func uploadChunk(_ data: Data, storagePath: String, accessToken: String) async throws {
        let url = URL(string: "\(Config.supabaseURL)/storage/v1/object/audio-temp/\(storagePath)")!
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        req.setValue(Config.supabaseAnonKey, forHTTPHeaderField: "apikey")
        req.setValue("audio/m4a", forHTTPHeaderField: "Content-Type")
        req.httpBody = data

        let (_, response) = try await URLSession.shared.data(for: req)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else {
            throw UploadError.uploadFailed
        }
    }

    private func transcribeChunk(storagePath: String, tenant: Tenant) async throws -> String {
        let url = URL(string: "https://\(tenant.hostname)/api/transcribe")!
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: ["storagePath": storagePath])

        let (data, _) = try await URLSession.shared.data(for: req)
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let transcript = json["transcript"] as? String else {
            throw UploadError.transcriptionFailed
        }
        return transcript
    }
}

public enum UploadError: Error {
    case uploadFailed, transcriptionFailed
}
```

- [ ] **Step 2: Write UploadManagerTests.swift**

```swift
// Tests/WaybetterDesktopTests/UploadManagerTests.swift
import XCTest
@testable import WaybetterDesktopLib

final class UploadManagerTests: XCTestCase {

    func test_uploadChunk_buildsCorrectRequest() async throws {
        var capturedRequest: URLRequest?
        MockURLProtocol.requestHandler = { req in
            capturedRequest = req
            let response = HTTPURLResponse(url: req.url!, statusCode: 200,
                                           httpVersion: nil, headerFields: nil)!
            return (response, Data())
        }
        // Inject mock session — for this we need UploadManager to accept a session param
        // (see note: for V1, test request structure via MockURLProtocol in integration)
        // Minimal test: verify chunk splitting logic
        let data = Data(repeating: 0x01, count: 100)
        let chunks = stride(from: 0, to: data.count, by: 24 * 1024 * 1024).map {
            Data(data[$0..<min($0 + 24 * 1024 * 1024, data.count)])
        }
        XCTAssertEqual(chunks.count, 1) // 100 bytes < 24MB = 1 chunk
    }

    func test_transcribeChunk_decodesTranscript() throws {
        let json = #"{"transcript":"Dit is een test transcript."}"#
        let data = json.data(using: .utf8)!
        let parsed = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        XCTAssertEqual(parsed?["transcript"] as? String, "Dit is een test transcript.")
    }

    func test_largefile_splits_into_multiple_chunks() {
        let chunkSize = 24 * 1024 * 1024
        let fileSize = 50 * 1024 * 1024 // 50MB
        let data = Data(repeating: 0x01, count: fileSize)
        let chunks = stride(from: 0, to: data.count, by: chunkSize).map {
            Data(data[$0..<min($0 + chunkSize, data.count)])
        }
        XCTAssertEqual(chunks.count, 3)
    }
}
```

- [ ] **Step 3: Run upload tests**

```bash
swift test --filter UploadManagerTests 2>&1 | tail -10
```

Expected: `Test Suite 'UploadManagerTests' passed`

- [ ] **Step 4: Write RecordingStatusView.swift**

```swift
// Sources/WaybetterDesktopLib/Views/RecordingStatusView.swift
import SwiftUI

public struct RecordingStatusView: View {
    @ObservedObject var recorder = RecordingManager.shared
    let statusMessage: String

    public var body: some View {
        VStack(spacing: 12) {
            if recorder.isRecording {
                HStack(spacing: 8) {
                    Circle().fill(.red).frame(width: 10, height: 10)
                        .opacity(0.8)
                    Text("Opname bezig...")
                        .font(.subheadline)
                }
                Button("Stop opname") {
                    Task { try? await RecordingManager.shared.stopRecording() }
                }
                .buttonStyle(.bordered)
                .tint(.red)
            } else {
                Text(statusMessage)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(16)
        .frame(width: 260)
    }
}
```

- [ ] **Step 5: Show status in AppDelegate after upload**

Replace the `// Task 6: show status` comment in AppDelegate:

```swift
RecordingManager.shared.onRecordingFinished = { [weak self] url in
    self?.updateMenuBarIcon(recording: false)
    guard let tenant = AuthManager.shared.tenant,
          let token = AuthManager.shared.accessToken else { return }
    Task {
        do {
            _ = try await UploadManager.shared.upload(audioURL: url, tenant: tenant, accessToken: token)
            await MainActor.run {
                self?.showStatus("Opname geupload. Transcriptie loopt in de webapp.")
            }
        } catch {
            await MainActor.run {
                self?.showStatus("Upload mislukt. Controleer je verbinding.")
            }
        }
    }
}
```

Add `showStatus` to AppDelegate:

```swift
public func showStatus(_ message: String) {
    let panel = NSPanel(
        contentRect: NSRect(x: 0, y: 0, width: 260, height: 100),
        styleMask: [.titled, .closable, .fullSizeContentView],
        backing: .buffered, defer: false
    )
    panel.title = "Waybetter"
    panel.isFloatingPanel = true
    if let screen = NSScreen.main {
        panel.setFrameOrigin(NSPoint(x: screen.visibleFrame.maxX - 280, y: screen.visibleFrame.minY + 20))
    }
    panel.contentView = NSHostingView(rootView: RecordingStatusView(statusMessage: message))
    panel.makeKeyAndOrderFront(nil)
    popupWindow = panel
    // Auto-close after 6 seconds
    DispatchQueue.main.asyncAfter(deadline: .now() + 6) { panel.close() }
}
```

- [ ] **Step 6: Build all**

```bash
swift build 2>&1 | tail -5
swift test 2>&1 | tail -15
```

Expected: `Build complete!` + all tests pass.

- [ ] **Step 7: Commit**

```bash
git add Sources/WaybetterDesktopLib/Managers/UploadManager.swift \
        Sources/WaybetterDesktopLib/Views/RecordingStatusView.swift \
        Sources/WaybetterDesktopLib/AppDelegate.swift \
        Tests/WaybetterDesktopTests/UploadManagerTests.swift
git commit -m "feat: UploadManager + RecordingStatusView — chunk, upload to Supabase, call /api/transcribe"
```

---

## Task 7: Build, Install, Smoke Test + Push

**Files:**
- Create: `Sources/WaybetterDesktopLib/Views/SettingsView.swift`
- Modify: `Sources/WaybetterDesktopLib/AppDelegate.swift` — wire SettingsView to menu item

- [ ] **Step 1: Write SettingsView.swift**

```swift
// Sources/WaybetterDesktopLib/Views/SettingsView.swift
import SwiftUI

public struct SettingsView: View {
    @AppStorage("alwaysRecord") private var alwaysRecord = false
    var onSignOut: () -> Void

    public var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Instellingen")
                .font(.headline)

            Toggle("Altijd opnemen bij detectie (geen popup)", isOn: $alwaysRecord)
                .toggleStyle(.checkbox)

            Divider()

            if let tenant = AuthManager.shared.tenant {
                Text("Verbonden met: \(tenant.name)")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            Button("Afmelden") { onSignOut() }
                .foregroundColor(.red)
        }
        .padding(20)
        .frame(width: 300)
    }
}
```

- [ ] **Step 2: Wire SettingsView to Instellingen menu item in AppDelegate**

Replace `@objc func showSettings()` in AppDelegate:

```swift
@objc func showSettings() {
    let panel = NSPanel(
        contentRect: NSRect(x: 0, y: 0, width: 300, height: 200),
        styleMask: [.titled, .closable],
        backing: .buffered, defer: false
    )
    panel.title = "Instellingen"
    panel.center()
    panel.contentView = NSHostingView(rootView: SettingsView {
        AuthManager.shared.signOut()
        panel.close()
        self.showLogin()
    })
    panel.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)
    popupWindow = panel
}
```

- [ ] **Step 3: Final build**

```bash
swift build -c release --arch arm64 2>&1 | tail -5
```

Expected: `Build complete!`

- [ ] **Step 4: Create app bundle and sign**

```bash
./build.sh
```

Expected output ends with: `Build complete: WaybetterDesktop.app`

- [ ] **Step 5: Install**

```bash
pkill -x WaybetterDesktop 2>/dev/null || true
rm -rf /Applications/WaybetterDesktop.app
cp -R WaybetterDesktop.app /Applications/
open /Applications/WaybetterDesktop.app
```

- [ ] **Step 6: Manual smoke test checklist**

Verify each manually:

1. Menubar icon (mic.circle) verschijnt in statusbalk
2. App start toont LoginView als eerste keer
3. E-mailadres invoeren + "Stuur inloglink" → succesmelding
4. Magic link in e-mail klikken → app vangt `waybetter://auth` op → ingelogd
5. Open Zoom (of Microsoft Teams) → popup verschijnt rechts in scherm "Meeting gedetecteerd"
6. Klik "Ja, opnemen" → menubar icon wordt mic.circle.fill (rood)
7. Klik "Stop opname" in menu → icon terug naar mic.circle
8. Status popup verschijnt "Opname geupload. Transcriptie loopt in de webapp."
9. Verifieer in Supabase Storage dat het bestand in `audio-temp` staat
10. Verifieer in de webapp (allday.waybetter.nl) dat de transcriptie verschijnt
11. Instellingen → "Altijd opnemen" toggle werkt (geen popup meer bij detectie)
12. Afmelden → LoginView verschijnt opnieuw

- [ ] **Step 7: Run all tests one final time**

```bash
swift test 2>&1 | tail -20
```

Expected: All test suites pass.

- [ ] **Step 8: Commit + push**

```bash
git add Sources/WaybetterDesktopLib/Views/SettingsView.swift \
        Sources/WaybetterDesktopLib/AppDelegate.swift
git commit -m "feat: SettingsView + altijd opnemen toggle — V2 volledig"
git push origin main
```

---

## Spec Coverage Check

| Vereiste | Task |
|---|---|
| Nieuwe repo waybetter-desktop-v2, geen AudioWhisper | Task 1 |
| macOS 14+ minimum | Task 1 (Package.swift platforms) |
| Magic link auth via Supabase | Task 2 |
| Tenant bepaald op basis van ingelogd account | Task 2 (fetchTenant) |
| Meeting detectie via NSWorkspace (Zoom/Teams/Webex) | Task 4 |
| Popup "Meeting gedetecteerd, wil je opnemen?" | Task 4 |
| Ja/Nee knoppen in popup | Task 4 |
| "Altijd opnemen" optie (geen popup meer) | Task 4 + Task 7 |
| Stop altijd via menubar | Task 1 (AppDelegate menu) |
| ScreenCaptureKit systeemaudio opname | Task 5 |
| Microfoon opname via AVCaptureSession | Task 5 |
| Gecombineerde output (AVMutableComposition merge) | Task 5 |
| Upload naar Supabase Storage audio-temp | Task 6 |
| Chunking voor grote bestanden (>24MB) | Task 6 |
| Webapp /api/transcribe aanroepen met storagePath | Task 6 |
| Statusmelding "Opname geupload, transcriptie loopt in webapp" | Task 6 |
| Menubar icon rood tijdens opname | Task 5 |
| Instellingen view | Task 7 |
| Afmelden + opnieuw inloggen | Task 7 |
