#pragma once

#include "CoreMinimal.h"
#include "Commandlets/Commandlet.h"
#include "UnrealAgentServer.h"
#include "UnrealAgentCommandlet.generated.h"

/**
 * Standalone commandlet that hosts the Blueprint MCP HTTP server.
 * Delegates all logic to FUnrealAgentServer and runs a manual engine tick loop.
 *
 * Usage:  UnrealEditor-Cmd.exe Project.uproject -run=UnrealAgent [-port=9847]
 */
UCLASS()
class UUnrealAgentCommandlet : public UCommandlet
{
	GENERATED_BODY()

public:
	UUnrealAgentCommandlet();
	virtual int32 Main(const FString& Params) override;

private:
	TUniquePtr<FUnrealAgentServer> Server;
};
