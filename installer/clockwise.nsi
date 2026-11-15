; Installatore di Clockwise per Windows (NSIS 3).
; Non si compila a mano: lo fa `npm run build:windows` (scripts/build-windows.mjs), che passa
;   -DVERSIONE=1.1.0 -DVERSIONE_NUMERICA=1.1.0.0 -DESEGUIBILE=<Clockwise.exe> -DICONA=<clockwise.ico>
;   -DUSCITA=<Clockwise-Setup-1.1.0.exe> [-DLICENZA_NODE=<LICENSE di Node.js>] [-DMANUALE=<docs/Manuale-Clockwise.pdf>]
; Il file è in UTF-8: makensis va chiamato con -INPUTCHARSET UTF8.
;
; Cosa fa: installa per il solo utente corrente (nessun diritto di amministratore) in
; %LOCALAPPDATA%\Programs\Clockwise, crea i collegamenti nel menu Start e sul desktop e
; registra il programma in "App installate" con il suo disinstallatore.
; In silenzioso: Clockwise-Setup-x.y.z.exe /S    e    Disinstalla.exe /S

Unicode true
ManifestDPIAware true
RequestExecutionLevel user
SetCompressor /SOLID lzma

!ifndef VERSIONE
  !error "Manca -DVERSIONE: usa npm run build:windows"
!endif
!ifndef VERSIONE_NUMERICA
  !define VERSIONE_NUMERICA "${VERSIONE}.0"
!endif
!ifndef ESEGUIBILE
  !error "Manca -DESEGUIBILE (percorso di Clockwise.exe)"
!endif
!ifndef ICONA
  !error "Manca -DICONA (percorso di clockwise.ico)"
!endif
!ifndef USCITA
  !error "Manca -DUSCITA (percorso dell'installatore da creare)"
!endif

; Firma del disinstallatore: build-windows.mjs passa -DFIRMA_NODE e -DFIRMA_SCRIPT solo se c'è un certificato.
!ifdef FIRMA_NODE
  !uninstfinalize '"${FIRMA_NODE}" "${FIRMA_SCRIPT}" "%1"' = 0
!endif

!define NOME "Clockwise"
!define EDITORE "Davide Tipaldi"
!define DESCRIZIONE "Clockwise — simulatore di punteggio bandi cinema"
!define CHIAVE_DISINSTALLA "Software\Microsoft\Windows\CurrentVersion\Uninstall\Clockwise"
!define CHIAVE_APP "Software\Clockwise"

Name "${NOME}"
OutFile "${USCITA}"
InstallDir "$LOCALAPPDATA\Programs\Clockwise"
InstallDirRegKey HKCU "${CHIAVE_APP}" "CartellaInstallazione"
BrandingText "${NOME} ${VERSIONE}"

!include "MUI2.nsh"
!include "FileFunc.nsh"

!define MUI_ICON "${ICONA}"
!define MUI_UNICON "${ICONA}"
!define MUI_ABORTWARNING

!define MUI_WELCOMEPAGE_TITLE "Installazione di Clockwise ${VERSIONE}"
!define MUI_WELCOMEPAGE_TEXT "Clockwise simula il punteggio dei bandi regionali per il cinema e l’audiovisivo prima dell’invio della domanda.$\r$\n$\r$\nIl programma viene installato solo per il tuo utente: non servono i diritti di amministratore. Troverai Clockwise nel menu Start e sul desktop.$\r$\n$\r$\nSe Clockwise è aperto verrà chiuso per poter aggiornare i file.$\r$\n$\r$\nPremi Installa per continuare."
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_TITLE "Clockwise è installato"
!define MUI_FINISHPAGE_TEXT "Per usarlo apri Clockwise dal menu Start o dal desktop: si apre una finestra nera (va lasciata aperta) e subito dopo il programma nel browser.$\r$\n$\r$\nPer chiudere Clockwise basta chiudere quella finestra."
!define MUI_FINISHPAGE_RUN "$INSTDIR\Clockwise.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Avvia Clockwise adesso"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "Italian"

VIProductVersion "${VERSIONE_NUMERICA}"
VIFileVersion "${VERSIONE_NUMERICA}"
VIAddVersionKey /LANG=${LANG_ITALIAN} "ProductName" "${NOME}"
VIAddVersionKey /LANG=${LANG_ITALIAN} "FileDescription" "Installazione di ${NOME}"
VIAddVersionKey /LANG=${LANG_ITALIAN} "CompanyName" "${EDITORE}"
VIAddVersionKey /LANG=${LANG_ITALIAN} "LegalCopyright" "${EDITORE}"
VIAddVersionKey /LANG=${LANG_ITALIAN} "FileVersion" "${VERSIONE}"
VIAddVersionKey /LANG=${LANG_ITALIAN} "ProductVersion" "${VERSIONE}"

; Il file .exe non si può sovrascrivere né cancellare mentre il programma è aperto.
!macro ChiudiClockwise
  nsExec::Exec '"$SYSDIR\taskkill.exe" /F /IM Clockwise.exe'
  Pop $0
  Sleep 700
!macroend

Section "Clockwise" SezioneProgramma
  SectionIn RO
  !insertmacro ChiudiClockwise

  SetOutPath "$INSTDIR"
  File "/oname=Clockwise.exe" "${ESEGUIBILE}"
  File "/oname=clockwise.ico" "${ICONA}"
!ifdef LICENZA_NODE
  File "/oname=Licenza Node.js.txt" "${LICENZA_NODE}"
!endif
!ifdef MANUALE
  File "/oname=Manuale di Clockwise.pdf" "${MANUALE}"
  CreateShortcut "$SMPROGRAMS\Manuale di Clockwise.lnk" "$INSTDIR\Manuale di Clockwise.pdf"
!endif
  WriteUninstaller "$INSTDIR\Disinstalla.exe"

  CreateShortcut "$SMPROGRAMS\Clockwise.lnk" "$INSTDIR\Clockwise.exe" "" "$INSTDIR\clockwise.ico" 0 SW_SHOWNORMAL "" "${DESCRIZIONE}"
  CreateShortcut "$DESKTOP\Clockwise.lnk" "$INSTDIR\Clockwise.exe" "" "$INSTDIR\clockwise.ico" 0 SW_SHOWNORMAL "" "${DESCRIZIONE}"

  WriteRegStr HKCU "${CHIAVE_APP}" "CartellaInstallazione" "$INSTDIR"
  WriteRegStr HKCU "${CHIAVE_DISINSTALLA}" "DisplayName" "${NOME}"
  WriteRegStr HKCU "${CHIAVE_DISINSTALLA}" "DisplayVersion" "${VERSIONE}"
  WriteRegStr HKCU "${CHIAVE_DISINSTALLA}" "Publisher" "${EDITORE}"
  WriteRegStr HKCU "${CHIAVE_DISINSTALLA}" "DisplayIcon" "$INSTDIR\clockwise.ico"
  WriteRegStr HKCU "${CHIAVE_DISINSTALLA}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${CHIAVE_DISINSTALLA}" "UninstallString" '"$INSTDIR\Disinstalla.exe"'
  WriteRegStr HKCU "${CHIAVE_DISINSTALLA}" "QuietUninstallString" '"$INSTDIR\Disinstalla.exe" /S'
  WriteRegDWORD HKCU "${CHIAVE_DISINSTALLA}" "NoModify" 1
  WriteRegDWORD HKCU "${CHIAVE_DISINSTALLA}" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "${CHIAVE_DISINSTALLA}" "EstimatedSize" "$0"
SectionEnd

Section "Uninstall"
  !insertmacro ChiudiClockwise

  Delete "$INSTDIR\Clockwise.exe"
  Delete "$INSTDIR\clockwise.ico"
  Delete "$INSTDIR\Licenza Node.js.txt"
  Delete "$INSTDIR\Manuale di Clockwise.pdf"
  Delete "$INSTDIR\Disinstalla.exe"
  RMDir "$INSTDIR"

  Delete "$SMPROGRAMS\Clockwise.lnk"
  Delete "$SMPROGRAMS\Manuale di Clockwise.lnk"
  Delete "$DESKTOP\Clockwise.lnk"
  DeleteRegKey HKCU "${CHIAVE_DISINSTALLA}"
  DeleteRegKey HKCU "${CHIAVE_APP}"

  ; Le impostazioni (chiave API salvata) restano, a meno che l'utente non chieda di toglierle.
  ; In silenzioso (/S) la risposta è No. I dossier vivono nel browser e non vengono toccati.
  IfFileExists "$APPDATA\Clockwise\*.*" 0 fineDati
  MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "Vuoi eliminare anche le impostazioni di Clockwise, compresa la chiave API salvata?$\r$\n$\r$\nI dossier restano comunque nel browser." /SD IDNO IDNO fineDati
    RMDir /r "$APPDATA\Clockwise"
  fineDati:
SectionEnd
