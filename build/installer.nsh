!macro customInstall
  DetailPrint "Registering TorrentHunt Protocol Handlers..."
  
  ; Register magnet: protocol
  WriteRegStr HKCU "Software\Classes\magnet" "" "URL:magnet protocol"
  WriteRegStr HKCU "Software\Classes\magnet" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\magnet\DefaultIcon" "" "$INSTDIR\TorrentHunt.exe,0"
  WriteRegStr HKCU "Software\Classes\magnet\shell\open\command" "" '"$INSTDIR\TorrentHunt.exe" "%1"'

  ; Register .torrent files
  WriteRegStr HKCU "Software\Classes\.torrent" "" "TorrentHunt.file"
  WriteRegStr HKCU "Software\Classes\TorrentHunt.file" "" "BitTorrent Document"
  WriteRegStr HKCU "Software\Classes\TorrentHunt.file\DefaultIcon" "" "$INSTDIR\TorrentHunt.exe,0"
  WriteRegStr HKCU "Software\Classes\TorrentHunt.file\shell\open\command" "" '"$INSTDIR\TorrentHunt.exe" "%1"'
!macroend

!macro customUnInstall
  DetailPrint "Removing TorrentHunt Protocol Handlers..."
  DeleteRegKey HKCU "Software\Classes\magnet"
  DeleteRegKey HKCU "Software\Classes\.torrent"
  DeleteRegKey HKCU "Software\Classes\TorrentHunt.file"
!macroend
