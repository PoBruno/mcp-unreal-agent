#include "UnrealAgentCommandlet.h"
#include "UnrealAgentServer.h"
#include "Containers/Ticker.h"

UUnrealAgentCommandlet::UUnrealAgentCommandlet()
{
	IsClient = false;
	IsEditor = true;
	IsServer = false;
	LogToConsole = true;
}

int32 UUnrealAgentCommandlet::Main(const FString& Params)
{
	// Parse port from command-line params
	TArray<FString> Tokens;
	TArray<FString> Switches;
	TMap<FString, FString> ParamMap;
	ParseCommandLine(*Params, Tokens, Switches, ParamMap);

	int32 Port = 9847;
	if (ParamMap.Contains(TEXT("port")))
	{
		Port = FCString::Atoi(*ParamMap[TEXT("port")]);
	}

	// Create and start the shared server
	Server = MakeUnique<FUnrealAgentServer>();
	if (!Server->Start(Port))
	{
		return 1;
	}

	// Main loop — tick the engine systems and process queued requests one at a time
	double LastTime = FPlatformTime::Seconds();

	auto TickEngine = [&LastTime]()
	{
		double CurrentTime = FPlatformTime::Seconds();
		double DeltaTime = CurrentTime - LastTime;
		LastTime = CurrentTime;
		FTSTicker::GetCoreTicker().Tick(DeltaTime);
	};

	while (!IsEngineExitRequested())
	{
		TickEngine();

		if (Server->ProcessOneRequest())
		{
			// Tick again immediately after completing a request so pending
			// HTTP responses get flushed.
			TickEngine();
		}

		FPlatformProcess::Sleep(0.01f);
	}

	Server->Stop();
	return 0;
}
