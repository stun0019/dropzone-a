[Version]
Class=IEXPRESS
SEDVersion=3

[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=1
HideExtractAnimation=1
HidePrompt=1
RebootMode=N
InstallPrompt=%InstallPrompt%
DisplayLicense=%DisplayLicense%
FinishMessage=%FinishMessage%
TargetName=%TargetName%
FriendlyName=%FriendlyName%
AppLaunched=%AppLaunched%
PostInstallCmd=%PostInstallCmd%
AdminQuietInstCmd=%AdminQuietInstCmd%
UserQuietInstCmd=%UserQuietInstCmd%
SourceFiles=SourceFiles

[Strings]
InstallPrompt=
DisplayLicense=
FinishMessage=
TargetName=D:\Github\Game\_dropzone\client\dropzone-a\DropzoneBuilder.exe
FriendlyName=Dropzone Builder
AppLaunched=cmd.exe /c build-dropzone.cmd
PostInstallCmd=<None>
AdminQuietInstCmd=
UserQuietInstCmd=
FILE0="build-dropzone.cmd"

[SourceFiles]
SourceFiles0=D:\Github\Game_dropzone\client\dropzone-a

[SourceFiles0]
%FILE0%=
