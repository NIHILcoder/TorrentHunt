; ============================================================
;  TorrentHunt — Custom NSIS Installer Script
;  Registers: magnet: protocol, .torrent file association
;  Background mode and autostart handled by Electron APIs.
; ============================================================

!macro customInstall
  DetailPrint "Registering TorrentHunt file associations..."

  ; ── Register magnet: protocol ──────────────────────────────
  WriteRegStr HKCU "Software\Classes\magnet" "" "URL:Magnet Protocol"
  WriteRegStr HKCU "Software\Classes\magnet" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\magnet\DefaultIcon" "" "$INSTDIR\TorrentHunt.exe,0"
  WriteRegStr HKCU "Software\Classes\magnet\shell" "" "open"
  WriteRegStr HKCU "Software\Classes\magnet\shell\open\command" "" '"$INSTDIR\TorrentHunt.exe" "%1"'

  ; ── Register .torrent file type ────────────────────────────
  WriteRegStr HKCU "Software\Classes\.torrent" "" "TorrentHunt.file"
  WriteRegStr HKCU "Software\Classes\.torrent" "Content Type" "application/x-bittorrent"

  WriteRegStr HKCU "Software\Classes\TorrentHunt.file" "" "BitTorrent Document"
  WriteRegStr HKCU "Software\Classes\TorrentHunt.file\DefaultIcon" "" "$INSTDIR\TorrentHunt.exe,0"
  WriteRegStr HKCU "Software\Classes\TorrentHunt.file\shell" "" "open"
  WriteRegStr HKCU "Software\Classes\TorrentHunt.file\shell\open" "" "Open with TorrentHunt"
  WriteRegStr HKCU "Software\Classes\TorrentHunt.file\shell\open\command" "" '"$INSTDIR\TorrentHunt.exe" "%1"'

  ; ── Register app as capable of handling these types ────────
  WriteRegStr HKCU "Software\TorrentHunt\Capabilities" "ApplicationName" "TorrentHunt"
  WriteRegStr HKCU "Software\TorrentHunt\Capabilities" "ApplicationDescription" "Modern BitTorrent Client"
  WriteRegStr HKCU "Software\TorrentHunt\Capabilities\FileAssociations" ".torrent" "TorrentHunt.file"
  WriteRegStr HKCU "Software\TorrentHunt\Capabilities\URLAssociations" "magnet" "TorrentHunt.magnet"

  ; Register with Windows "Open With" dialog
  WriteRegStr HKCU "Software\RegisteredApplications" "TorrentHunt" "Software\TorrentHunt\Capabilities"

  ; Notify Windows Shell of the changes
  ; (SHChangeNotify equivalent — Windows will refresh associations)
  System::Call 'shell32.dll::SHChangeNotify(i, i, i, i) v (0x08000000, 0, 0, 0)'

  DetailPrint "TorrentHunt registered as torrent handler."
!macroend

!macro customUnInstall
  DetailPrint "Removing TorrentHunt file associations..."

  ; Remove magnet: protocol handler
  DeleteRegKey HKCU "Software\Classes\magnet"

  ; Remove .torrent file association (only if we own it)
  ReadRegStr $0 HKCU "Software\Classes\.torrent" ""
  StrCmp $0 "TorrentHunt.file" 0 +2
    DeleteRegKey HKCU "Software\Classes\.torrent"

  DeleteRegKey HKCU "Software\Classes\TorrentHunt.file"
  DeleteRegKey HKCU "Software\TorrentHunt"
  DeleteRegValue HKCU "Software\RegisteredApplications" "TorrentHunt"

  ; Remove autostart entry if present
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "TorrentHunt"

  ; Notify Windows Shell
  System::Call 'shell32.dll::SHChangeNotify(i, i, i, i) v (0x08000000, 0, 0, 0)'

  DetailPrint "TorrentHunt unregistered."
!macroend
