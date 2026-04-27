import AppKit

let size = CGSize(width: 1024, height: 1024)
let background = NSColor(calibratedRed: 0.96, green: 0.93, blue: 0.87, alpha: 1.0)
let frameColor = NSColor(calibratedWhite: 0.08, alpha: 1.0)
let accent = NSColor(calibratedRed: 0.86, green: 0.21, blue: 0.18, alpha: 1.0)

let image = NSImage(size: size)
image.lockFocus()

background.setFill()
NSBezierPath(rect: NSRect(origin: .zero, size: size)).fill()

let frameRect = NSRect(x: 176, y: 176, width: 672, height: 672)
let framePath = NSBezierPath(rect: frameRect)
framePath.lineWidth = 10
frameColor.setStroke()
framePath.stroke()

let paragraph = NSMutableParagraphStyle()
paragraph.alignment = .center

let textStyle: [NSAttributedString.Key: Any] = [
  .font: NSFont(name: "Georgia-Bold", size: 122) ?? NSFont.boldSystemFont(ofSize: 122),
  .foregroundColor: frameColor,
  .paragraphStyle: paragraph,
  .kern: 2.5,
]

let subStyle: [NSAttributedString.Key: Any] = [
  .font: NSFont(name: "Georgia", size: 42) ?? NSFont.systemFont(ofSize: 42),
  .foregroundColor: frameColor.withAlphaComponent(0.82),
  .paragraphStyle: paragraph,
  .kern: 3.2,
]

let title = NSAttributedString(string: "WOA", attributes: textStyle)
let titleRect = NSRect(x: 192, y: 475, width: 640, height: 150)
title.draw(in: titleRect)

let subtitle = NSAttributedString(string: "WORK(ER) OF ART", attributes: subStyle)
let subtitleRect = NSRect(x: 170, y: 365, width: 684, height: 64)
subtitle.draw(in: subtitleRect)

let dotPath = NSBezierPath(ovalIn: NSRect(x: 742, y: 432, width: 54, height: 54))
accent.setFill()
dotPath.fill()

image.unlockFocus()

guard
  let tiffData = image.tiffRepresentation,
  let bitmap = NSBitmapImageRep(data: tiffData),
  let pngData = bitmap.representation(using: .png, properties: [:])
else {
  fatalError("Failed to generate PNG data")
}

let outputs = [
  "assets/icon.png",
  "assets/adaptive-icon.png",
]

for path in outputs {
  let url = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
    .appendingPathComponent(path)
  try pngData.write(to: url)
}
