#include "UnrealAgentEditorSubsystem.h"
#include "UnrealAgentServer.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "AssetRegistry/IAssetRegistry.h"

void UUnrealAgentEditorSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);

	// Don't start in commandlet mode — the commandlet has its own server instance.
	if (IsRunningCommandlet())
	{
		return;
	}

	Server = MakeUnique<FUnrealAgentServer>();
	if (Server->Start(9847, /*bEditorMode=*/true))
	{
		UE_LOG(LogTemp, Display, TEXT("UnrealAgent: Editor subsystem started — MCP server on port %d"), Server->GetPort());

		// Asset Registry loads asynchronously during editor startup.
		// The initial scan in Start() only sees engine assets.
		// Defer a full rescan until the registry finishes gathering.
		FAssetRegistryModule& ARM = FModuleManager::LoadModuleChecked<FAssetRegistryModule>("AssetRegistry");
		IAssetRegistry& AR = ARM.Get();

		if (AR.IsGathering())
		{
			OnFilesLoadedHandle = AR.OnFilesLoaded().AddUObject(
				this, &UUnrealAgentEditorSubsystem::HandleAssetRegistryReady);
		}
	}
	else
	{
		UE_LOG(LogTemp, Warning, TEXT("UnrealAgent: Editor subsystem failed to start MCP server (port may be in use)"));
		Server.Reset();
	}
}

void UUnrealAgentEditorSubsystem::HandleAssetRegistryReady()
{
	if (OnFilesLoadedHandle.IsValid())
	{
		FAssetRegistryModule& ARM = FModuleManager::LoadModuleChecked<FAssetRegistryModule>("AssetRegistry");
		ARM.Get().OnFilesLoaded().Remove(OnFilesLoadedHandle);
		OnFilesLoadedHandle.Reset();
	}

	if (Server && Server->IsRunning())
	{
		Server->HandleRescan();
		UE_LOG(LogTemp, Display, TEXT("UnrealAgent: Deferred rescan complete after Asset Registry finished gathering."));
	}
}

void UUnrealAgentEditorSubsystem::Deinitialize()
{
	if (OnFilesLoadedHandle.IsValid() && FModuleManager::Get().IsModuleLoaded("AssetRegistry"))
	{
		FAssetRegistryModule& ARM = FModuleManager::GetModuleChecked<FAssetRegistryModule>("AssetRegistry");
		ARM.Get().OnFilesLoaded().Remove(OnFilesLoadedHandle);
		OnFilesLoadedHandle.Reset();
	}

	if (Server)
	{
		Server->Stop();
		Server.Reset();
		UE_LOG(LogTemp, Display, TEXT("UnrealAgent: Editor subsystem stopped."));
	}

	Super::Deinitialize();
}

void UUnrealAgentEditorSubsystem::Tick(float DeltaTime)
{
	if (Server)
	{
		Server->ProcessOneRequest();
	}
}

bool UUnrealAgentEditorSubsystem::IsTickable() const
{
	return Server.IsValid() && Server->IsRunning();
}

TStatId UUnrealAgentEditorSubsystem::GetStatId() const
{
	RETURN_QUICK_DECLARE_CYCLE_STAT(UUnrealAgentEditorSubsystem, STATGROUP_Tickables);
}
