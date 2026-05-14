import Cocoa
import Carbon

// Usage: sendkeys <keycode> <flags>
let args = CommandLine.arguments
guard args.count >= 3,
      let keyCode = UInt16(args[1]),
      let flagsRaw = UInt(args[2]) else {
    exit(1)
}

var flags: CGEventFlags = []
if flagsRaw & 1 != 0 { flags.insert(.maskCommand) }
if flagsRaw & 2 != 0 { flags.insert(.maskShift) }
if flagsRaw & 4 != 0 { flags.insert(.maskControl) }
if flagsRaw & 8 != 0 { flags.insert(.maskAlternate) }

let src = CGEventSource(stateID: .combinedSessionState)
if let down = CGEvent(keyboardEventSource: src, virtualKey: keyCode, keyDown: true),
   let up = CGEvent(keyboardEventSource: src, virtualKey: keyCode, keyDown: false) {
    down.flags = flags
    up.flags = flags
    down.post(tap: .cgSessionEventTap)
    usleep(20000)
    up.post(tap: .cgSessionEventTap)
}
