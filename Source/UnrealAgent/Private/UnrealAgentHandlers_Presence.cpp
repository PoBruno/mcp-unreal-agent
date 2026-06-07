#include "UnrealAgentServer.h"
#include "Editor.h"
#include "Engine/World.h"
#include "Engine/SceneCapture2D.h"
#include "Components/SceneCaptureComponent2D.h"
#include "Engine/TextureRenderTarget2D.h"
#include "Kismet/KismetRenderingLibrary.h"
#include "Engine/Blueprint.h"
#include "Subsystems/AssetEditorSubsystem.h"
#include "Settings/EditorStyleSettings.h"
#include "Misc/Paths.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonWriter.h"
#include "Serialization/JsonSerializer.h"

// ============================================================
// HandleCaptureScene — render the scene OFFSCREEN via a SceneCapture2D so it
// works regardless of whether the editor window is focused/realized (R-04 real
// fix). Renders from an explicit camera to an 8-bit render target and exports PNG.
// ============================================================

FString FUnrealAgentServer::HandleCaptureScene(const FString& Body)
{
	TSharedPtr<FJsonObject> Json = ParseBodyJson(Body);
	if (!Json.IsValid())
	{
		return MakeErrorJson(TEXT("Invalid JSON body."));
	}

	if (!bIsEditor)
	{
		return MakeErrorJson(TEXT("capture_scene requires editor mode."));
	}

	UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
	if (!World)
	{
		return MakeErrorJson(TEXT("No editor world available."));
	}

	int32 Width = 1280;
	int32 Height = 720;
	{
		double W = 0, H = 0;
		if (Json->TryGetNumberField(TEXT("width"), W) && W > 0) Width = FMath::Clamp((int32)W, 64, 7680);
		if (Json->TryGetNumberField(TEXT("height"), H) && H > 0) Height = FMath::Clamp((int32)H, 64, 4320);
	}

	FVector Location(900.0, 900.0, 600.0);
	FRotator Rotation(-25.0, -135.0, 0.0); // pitch, yaw, roll
	const TSharedPtr<FJsonObject>* LocObj = nullptr;
	if (Json->TryGetObjectField(TEXT("location"), LocObj) && LocObj)
	{
		(*LocObj)->TryGetNumberField(TEXT("x"), Location.X);
		(*LocObj)->TryGetNumberField(TEXT("y"), Location.Y);
		(*LocObj)->TryGetNumberField(TEXT("z"), Location.Z);
	}
	const TSharedPtr<FJsonObject>* RotObj = nullptr;
	if (Json->TryGetObjectField(TEXT("rotation"), RotObj) && RotObj)
	{
		(*RotObj)->TryGetNumberField(TEXT("pitch"), Rotation.Pitch);
		(*RotObj)->TryGetNumberField(TEXT("yaw"), Rotation.Yaw);
		(*RotObj)->TryGetNumberField(TEXT("roll"), Rotation.Roll);
	}

	FString Filename;
	if (!Json->TryGetStringField(TEXT("filename"), Filename) || Filename.IsEmpty())
	{
		Filename = FString::Printf(TEXT("SceneCapture_%s"), *FDateTime::Now().ToString(TEXT("%Y%m%d_%H%M%S")));
	}
	if (!Filename.EndsWith(TEXT(".png"))) { Filename += TEXT(".png"); }

	ASceneCapture2D* Cap = World->SpawnActor<ASceneCapture2D>(Location, Rotation);
	if (!Cap)
	{
		return MakeErrorJson(TEXT("Failed to spawn SceneCapture2D."));
	}

	USceneCaptureComponent2D* Comp = Cap->GetCaptureComponent2D();
	UTextureRenderTarget2D* RT = UKismetRenderingLibrary::CreateRenderTarget2D(
		World, Width, Height, ETextureRenderTargetFormat::RTF_RGBA8);
	if (!Comp || !RT)
	{
		World->DestroyActor(Cap);
		return MakeErrorJson(TEXT("Failed to create render target."));
	}

	Comp->TextureTarget = RT;
	Comp->CaptureSource = ESceneCaptureSource::SCS_FinalColorLDR;
	Comp->bCaptureEveryFrame = false;
	Comp->CaptureScene();

	FString OutDir = FPaths::ConvertRelativePathToFull(FPaths::ProjectSavedDir() / TEXT("Screenshots"));
	UKismetRenderingLibrary::ExportRenderTarget(World, RT, OutDir, Filename);

	World->DestroyActor(Cap);

	const FString FullPath = OutDir / Filename;
	TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();
	Result->SetBoolField(TEXT("success"), true);
	Result->SetStringField(TEXT("filename"), Filename);
	Result->SetStringField(TEXT("fullPath"), FullPath);
	Result->SetNumberField(TEXT("width"), Width);
	Result->SetNumberField(TEXT("height"), Height);
	UE_LOG(LogTemp, Display, TEXT("UnrealAgent: capture_scene -> %s (%dx%d)"), *FullPath, Width, Height);
	return JsonToString(Result);
}

// ============================================================
// Presence / auto-reveal
// ============================================================

void FUnrealAgentServer::RevealBlueprintEditor(UBlueprint* BP)
{
	if (!bAutoRevealAssets || !BP || !GEditor) { return; }

	UAssetEditorSubsystem* AES = GEditor->GetEditorSubsystem<UAssetEditorSubsystem>();
	if (!AES) { return; }

	// Dock as a tab in the main window (never a floating window), restore pref after.
	UEditorStyleSettings* StyleSettings = GetMutableDefault<UEditorStyleSettings>();
	const EAssetEditorOpenLocation Prev = StyleSettings->AssetEditorOpenLocation;
	StyleSettings->AssetEditorOpenLocation = EAssetEditorOpenLocation::MainWindow;
	AES->OpenEditorForAsset(BP);
	StyleSettings->AssetEditorOpenLocation = Prev;
}

FString FUnrealAgentServer::HandleSetPresence(const FString& Body)
{
	TSharedPtr<FJsonObject> Json = ParseBodyJson(Body);
	if (!Json.IsValid())
	{
		return MakeErrorJson(TEXT("Invalid JSON body."));
	}

	bool bEnabled = bAutoRevealAssets;
	Json->TryGetBoolField(TEXT("enabled"), bEnabled);
	bAutoRevealAssets = bEnabled;

	TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();
	Result->SetBoolField(TEXT("success"), true);
	Result->SetBoolField(TEXT("autoReveal"), bAutoRevealAssets);
	return JsonToString(Result);
}
