#include "UnrealAgentServer.h"
#include "Editor.h"
#include "Engine/Engine.h"
#include "Engine/GameViewportClient.h"
#include "LevelEditorViewport.h"
#include "UnrealClient.h"
#include "HighResScreenshot.h"
#include "RenderingThread.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "ImageUtils.h"
#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Serialization/JsonWriter.h"
#include "Serialization/JsonSerializer.h"

// ============================================================
// HandleTakeScreenshot — capture a viewport screenshot
// ============================================================

FString FUnrealAgentServer::HandleTakeScreenshot(const FString& Body)
{
	TSharedPtr<FJsonObject> Json = ParseBodyJson(Body);
	if (!Json.IsValid())
	{
		return MakeErrorJson(TEXT("Invalid JSON body."));
	}

	UE_LOG(LogTemp, Display, TEXT("UnrealAgent: take_screenshot()"));

	if (!bIsEditor)
	{
		return MakeErrorJson(TEXT("take_screenshot requires editor mode."));
	}

	if (!GEditor)
	{
		return MakeErrorJson(TEXT("Editor not available."));
	}

	FString Filename;
	if (!Json->TryGetStringField(TEXT("filename"), Filename) || Filename.IsEmpty())
	{
		Filename = FString::Printf(TEXT("Screenshot_%s"), *FDateTime::Now().ToString(TEXT("%Y%m%d_%H%M%S")));
	}

	// Ensure .png extension
	if (!Filename.EndsWith(TEXT(".png")))
	{
		Filename += TEXT(".png");
	}

	// Output directory
	FString OutputDir = FPaths::ProjectSavedDir() / TEXT("Screenshots");
	FString FullPath = OutputDir / Filename;

	// Prefer the PIE game viewport when playing — that's where gameplay (and the
	// framing component) actually renders. Falls back to the editor level viewport.
	// R-04: GetLevelViewportClients()[0] is often NOT the realized perspective
	// viewport (size 0x0). Prefer the active client, then any client with a valid
	// size, and force a redraw so the back buffer is current before ReadPixels.
	FViewport* Viewport = nullptr;
	if (GEditor->PlayWorld && GEngine && GEngine->GameViewport && GEngine->GameViewport->Viewport)
	{
		Viewport = GEngine->GameViewport->Viewport;
	}
	if ((!Viewport || Viewport->GetSizeXY().X <= 0) && GCurrentLevelEditingViewportClient
		&& GCurrentLevelEditingViewportClient->Viewport)
	{
		Viewport = GCurrentLevelEditingViewportClient->Viewport;
	}
	if (!Viewport || Viewport->GetSizeXY().X <= 0)
	{
		for (FLevelEditorViewportClient* Client : GEditor->GetLevelViewportClients())
		{
			if (Client && Client->Viewport && Client->Viewport->GetSizeXY().X > 0)
			{
				Viewport = Client->Viewport;
				break;
			}
		}
	}

	if (!Viewport)
	{
		return MakeErrorJson(TEXT("No active viewport found."));
	}

	// Force the viewport to render a frame so the back buffer is populated.
	GEditor->RedrawLevelEditingViewports(true);
	FlushRenderingCommands();

	// Read pixels from viewport
	TArray<FColor> Bitmap;
	int32 Width = Viewport->GetSizeXY().X;
	int32 Height = Viewport->GetSizeXY().Y;

	if (Width <= 0 || Height <= 0)
	{
		return MakeErrorJson(TEXT("Viewport has invalid dimensions (no realized level viewport — ensure a level editor viewport is open/visible)."));
	}

	bool bReadSuccess = Viewport->ReadPixels(Bitmap);
	if (!bReadSuccess || Bitmap.Num() == 0)
	{
		return MakeErrorJson(TEXT("Failed to read pixels from viewport."));
	}

	// Save as PNG (PNGCompressImageArray requires TArray64 in UE 5.7)
	TArray64<uint8> PngData;
	FImageUtils::PNGCompressImageArray(Width, Height, Bitmap, PngData);

	IPlatformFile& PlatformFile = FPlatformFileManager::Get().GetPlatformFile();
	PlatformFile.CreateDirectoryTree(*OutputDir);

	bool bSaved = FFileHelper::SaveArrayToFile(PngData, *FullPath);
	if (!bSaved)
	{
		return MakeErrorJson(FString::Printf(TEXT("Failed to save screenshot to '%s'."), *FullPath));
	}

	TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();
	Result->SetBoolField(TEXT("success"), true);
	Result->SetStringField(TEXT("filename"), Filename);
	Result->SetStringField(TEXT("fullPath"), FullPath);
	Result->SetNumberField(TEXT("width"), Width);
	Result->SetNumberField(TEXT("height"), Height);

	UE_LOG(LogTemp, Display, TEXT("UnrealAgent: Screenshot saved to '%s' (%dx%d)"), *FullPath, Width, Height);

	return JsonToString(Result);
}

// ============================================================
// HandleTakeHighResScreenshot — capture a high-resolution screenshot
// ============================================================

FString FUnrealAgentServer::HandleTakeHighResScreenshot(const FString& Body)
{
	TSharedPtr<FJsonObject> Json = ParseBodyJson(Body);
	if (!Json.IsValid())
	{
		return MakeErrorJson(TEXT("Invalid JSON body."));
	}

	UE_LOG(LogTemp, Display, TEXT("UnrealAgent: take_high_res_screenshot()"));

	if (!bIsEditor)
	{
		return MakeErrorJson(TEXT("take_high_res_screenshot requires editor mode."));
	}

	if (!GEditor)
	{
		return MakeErrorJson(TEXT("Editor not available."));
	}

	double ResMultiplier = 2.0;
	Json->TryGetNumberField(TEXT("resolutionMultiplier"), ResMultiplier);
	if (ResMultiplier < 1.0) ResMultiplier = 1.0;
	if (ResMultiplier > 8.0) ResMultiplier = 8.0;

	FString Filename;
	if (!Json->TryGetStringField(TEXT("filename"), Filename) || Filename.IsEmpty())
	{
		Filename = FString::Printf(TEXT("HighRes_%s"), *FDateTime::Now().ToString(TEXT("%Y%m%d_%H%M%S")));
	}

	if (!Filename.EndsWith(TEXT(".png")))
	{
		Filename += TEXT(".png");
	}

	FString OutputDir = FPaths::ProjectSavedDir() / TEXT("Screenshots");
	FString FullPath = OutputDir / Filename;

	// R-04: prefer the active viewport client, then any with a valid size.
	FLevelEditorViewportClient* ViewportClient = GCurrentLevelEditingViewportClient;
	if (!ViewportClient || !ViewportClient->Viewport || ViewportClient->Viewport->GetSizeXY().X <= 0)
	{
		for (FLevelEditorViewportClient* Client : GEditor->GetLevelViewportClients())
		{
			if (Client && Client->Viewport && Client->Viewport->GetSizeXY().X > 0)
			{
				ViewportClient = Client;
				break;
			}
		}
	}

	if (!ViewportClient || !ViewportClient->Viewport)
	{
		return MakeErrorJson(TEXT("No active viewport found."));
	}

	// Fall back to a sane resolution when the viewport hasn't been realized (size 0).
	int32 BaseW = ViewportClient->Viewport->GetSizeXY().X;
	int32 BaseH = ViewportClient->Viewport->GetSizeXY().Y;
	if (BaseW <= 0 || BaseH <= 0) { BaseW = 1920; BaseH = 1080; }

	// Configure high-res screenshot settings
	FHighResScreenshotConfig& Config = GetHighResScreenshotConfig();
	Config.SetResolution(BaseW, BaseH, ResMultiplier);
	Config.SetFilename(FullPath);
	Config.bMaskEnabled = false;

	// Request the screenshot
	ViewportClient->Viewport->TakeHighResScreenShot();

	int32 FinalWidth = FMath::CeilToInt(BaseW * ResMultiplier);
	int32 FinalHeight = FMath::CeilToInt(BaseH * ResMultiplier);

	TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();
	Result->SetBoolField(TEXT("success"), true);
	Result->SetStringField(TEXT("filename"), Filename);
	Result->SetStringField(TEXT("fullPath"), FullPath);
	Result->SetNumberField(TEXT("resolutionMultiplier"), ResMultiplier);
	Result->SetNumberField(TEXT("estimatedWidth"), FinalWidth);
	Result->SetNumberField(TEXT("estimatedHeight"), FinalHeight);
	Result->SetStringField(TEXT("note"), TEXT("High-res screenshot is captured asynchronously. The file may take a moment to appear on disk."));

	UE_LOG(LogTemp, Display, TEXT("UnrealAgent: High-res screenshot requested at %dx multiplier -> '%s'"), (int32)ResMultiplier, *FullPath);

	return JsonToString(Result);
}
