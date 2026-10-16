; Chromium's Windows sandbox (LPAC) must be able to read the install tree
; (icudtl.dat, *.pak, DLLs). Without this grant, child processes die during
; ICU init with: "Invalid file descriptor to ICU data received."
; See: https://github.com/electron/electron/issues/49143

!macro customInstall
  ; ALL APPLICATION PACKAGES
  nsExec::ExecToLog 'icacls "$INSTDIR" /grant *S-1-15-2-1:(OI)(CI)(RX) /T /C /Q'
  ; ALL RESTRICTED APPLICATION PACKAGES (required for LPAC / network sandbox)
  nsExec::ExecToLog 'icacls "$INSTDIR" /grant *S-1-15-2-2:(OI)(CI)(RX) /T /C /Q'
!macroend
