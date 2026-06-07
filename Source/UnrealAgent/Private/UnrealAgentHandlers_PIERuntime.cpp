#include "UnrealAgentServer.h"
#include "Editor.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/Actor.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/Pawn.h"
#include "GameFramework/Character.h"
#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Serialization/JsonWriter.h"
#include "Serialization/JsonSerializer.h"

// ============================================================
// Helper — get the PIE world or return error
// ============================================================

static UWorld* GetPIEWorld(bool bIsEditor, FString& OutError)
{
	if (!bIsEditor)
	{
		OutError = TEXT("This tool requires editor mode.");
		return nullptr;
	}

	if (!GEditor || !GEditor->PlayWorld)
	{
		OutError = TEXT("PIE is not running. Use start_pie first.");
		return nullptr;
	}

	return GEditor->PlayWorld;
}

// ============================================================
// HandlePIEGetPlayerTransform — get player pawn location/rotation
// ============================================================

FString FUnrealAgentServer::HandlePIEGetPlayerTransform(const FString& Body)
{
	UE_LOG(LogTemp, Display, TEXT("UnrealAgent: pie_get_player_transform()"));

	FString Error;
	UWorld* PIEWorld = GetPIEWorld(bIsEditor, Error);
	if (!PIEWorld) return MakeErrorJson(Error);

	APlayerController* PC = PIEWorld->GetFirstPlayerController();
	if (!PC)
	{
		return MakeErrorJson(TEXT("No player controller found in PIE world."));
	}

	APawn* PlayerPawn = PC->GetPawn();
	if (!PlayerPawn)
	{
		return MakeErrorJson(TEXT("No player pawn found. The player may not have possessed a pawn yet."));
	}

	FVector Location = PlayerPawn->GetActorLocation();
	FRotator Rotation = PlayerPawn->GetActorRotation();
	FVector Velocity = PlayerPawn->GetVelocity();

	TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();

	TSharedRef<FJsonObject> LocObj = MakeShared<FJsonObject>();
	LocObj->SetNumberField(TEXT("x"), Location.X);
	LocObj->SetNumberField(TEXT("y"), Location.Y);
	LocObj->SetNumberField(TEXT("z"), Location.Z);
	Result->SetObjectField(TEXT("location"), LocObj);

	TSharedRef<FJsonObject> RotObj = MakeShared<FJsonObject>();
	RotObj->SetNumberField(TEXT("pitch"), Rotation.Pitch);
	RotObj->SetNumberField(TEXT("yaw"), Rotation.Yaw);
	RotObj->SetNumberField(TEXT("roll"), Rotation.Roll);
	Result->SetObjectField(TEXT("rotation"), RotObj);

	TSharedRef<FJsonObject> VelObj = MakeShared<FJsonObject>();
	VelObj->SetNumberField(TEXT("x"), Velocity.X);
	VelObj->SetNumberField(TEXT("y"), Velocity.Y);
	VelObj->SetNumberField(TEXT("z"), Velocity.Z);
	Result->SetObjectField(TEXT("velocity"), VelObj);

	Result->SetStringField(TEXT("pawnClass"), PlayerPawn->GetClass()->GetName());
	Result->SetNumberField(TEXT("speed"), Velocity.Size());

	return JsonToString(Result);
}

// ============================================================
// HandlePIETeleportPlayer — teleport the player pawn
// ============================================================

FString FUnrealAgentServer::HandlePIETeleportPlayer(const FString& Body)
{
	TSharedPtr<FJsonObject> Json = ParseBodyJson(Body);
	if (!Json.IsValid())
	{
		return MakeErrorJson(TEXT("Invalid JSON body."));
	}

	UE_LOG(LogTemp, Display, TEXT("UnrealAgent: pie_teleport_player()"));

	FString Error;
	UWorld* PIEWorld = GetPIEWorld(bIsEditor, Error);
	if (!PIEWorld) return MakeErrorJson(Error);

	APlayerController* PC = PIEWorld->GetFirstPlayerController();
	if (!PC)
	{
		return MakeErrorJson(TEXT("No player controller found in PIE world."));
	}

	APawn* PlayerPawn = PC->GetPawn();
	if (!PlayerPawn)
	{
		return MakeErrorJson(TEXT("No player pawn found."));
	}

	// Parse location
	const TSharedPtr<FJsonObject>* LocObj = nullptr;
	if (!Json->TryGetObjectField(TEXT("location"), LocObj))
	{
		return MakeErrorJson(TEXT("Missing required field: 'location' with x, y, z coordinates."));
	}

	double X = 0, Y = 0, Z = 0;
	(*LocObj)->TryGetNumberField(TEXT("x"), X);
	(*LocObj)->TryGetNumberField(TEXT("y"), Y);
	(*LocObj)->TryGetNumberField(TEXT("z"), Z);

	FVector NewLocation(X, Y, Z);

	// Parse optional rotation
	FRotator NewRotation = PlayerPawn->GetActorRotation();
	const TSharedPtr<FJsonObject>* RotObj = nullptr;
	if (Json->TryGetObjectField(TEXT("rotation"), RotObj))
	{
		double Pitch = 0, Yaw = 0, Roll = 0;
		(*RotObj)->TryGetNumberField(TEXT("pitch"), Pitch);
		(*RotObj)->TryGetNumberField(TEXT("yaw"), Yaw);
		(*RotObj)->TryGetNumberField(TEXT("roll"), Roll);
		NewRotation = FRotator(Pitch, Yaw, Roll);
	}

	bool bTeleported = PlayerPawn->TeleportTo(NewLocation, NewRotation);

	TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();
	Result->SetBoolField(TEXT("success"), bTeleported);

	FVector FinalLoc = PlayerPawn->GetActorLocation();
	TSharedRef<FJsonObject> FinalLocObj = MakeShared<FJsonObject>();
	FinalLocObj->SetNumberField(TEXT("x"), FinalLoc.X);
	FinalLocObj->SetNumberField(TEXT("y"), FinalLoc.Y);
	FinalLocObj->SetNumberField(TEXT("z"), FinalLoc.Z);
	Result->SetObjectField(TEXT("location"), FinalLocObj);

	FRotator FinalRot = PlayerPawn->GetActorRotation();
	TSharedRef<FJsonObject> FinalRotObj = MakeShared<FJsonObject>();
	FinalRotObj->SetNumberField(TEXT("pitch"), FinalRot.Pitch);
	FinalRotObj->SetNumberField(TEXT("yaw"), FinalRot.Yaw);
	FinalRotObj->SetNumberField(TEXT("roll"), FinalRot.Roll);
	Result->SetObjectField(TEXT("rotation"), FinalRotObj);

	if (!bTeleported)
	{
		Result->SetStringField(TEXT("warning"), TEXT("Teleport failed. The destination may be blocked by collision."));
	}

	return JsonToString(Result);
}

// ============================================================
// HandlePIEQueryActors — query actors in the PIE world
// ============================================================

FString FUnrealAgentServer::HandlePIEQueryActors(const FString& Body)
{
	TSharedPtr<FJsonObject> Json = ParseBodyJson(Body);
	if (!Json.IsValid())
	{
		return MakeErrorJson(TEXT("Invalid JSON body."));
	}

	UE_LOG(LogTemp, Display, TEXT("UnrealAgent: pie_query_actors()"));

	FString Error;
	UWorld* PIEWorld = GetPIEWorld(bIsEditor, Error);
	if (!PIEWorld) return MakeErrorJson(Error);

	FString ClassFilter;
	Json->TryGetStringField(TEXT("classFilter"), ClassFilter);

	FString TagFilter;
	Json->TryGetStringField(TEXT("tagFilter"), TagFilter);

	int32 MaxResults = 100;
	Json->TryGetNumberField(TEXT("maxResults"), MaxResults);
	if (MaxResults <= 0) MaxResults = 100;
	if (MaxResults > 1000) MaxResults = 1000;

	TArray<TSharedPtr<FJsonValue>> ActorArray;
	int32 Count = 0;

	for (TActorIterator<AActor> It(PIEWorld); It && Count < MaxResults; ++It)
	{
		AActor* Actor = *It;
		if (!Actor) continue;

		// Apply class filter
		if (!ClassFilter.IsEmpty())
		{
			FString ClassName = Actor->GetClass()->GetName();
			if (!ClassName.Contains(ClassFilter, ESearchCase::IgnoreCase))
			{
				continue;
			}
		}

		// Apply tag filter
		if (!TagFilter.IsEmpty())
		{
			bool bHasTag = false;
			for (const FName& Tag : Actor->Tags)
			{
				if (Tag.ToString().Contains(TagFilter, ESearchCase::IgnoreCase))
				{
					bHasTag = true;
					break;
				}
			}
			if (!bHasTag) continue;
		}

		TSharedRef<FJsonObject> ActorObj = MakeShared<FJsonObject>();
		ActorObj->SetStringField(TEXT("name"), Actor->GetName());
		ActorObj->SetStringField(TEXT("label"), Actor->GetActorLabel());
		ActorObj->SetStringField(TEXT("class"), Actor->GetClass()->GetName());

		FVector Loc = Actor->GetActorLocation();
		TSharedRef<FJsonObject> LocObj = MakeShared<FJsonObject>();
		LocObj->SetNumberField(TEXT("x"), Loc.X);
		LocObj->SetNumberField(TEXT("y"), Loc.Y);
		LocObj->SetNumberField(TEXT("z"), Loc.Z);
		ActorObj->SetObjectField(TEXT("location"), LocObj);

		// Tags
		TArray<TSharedPtr<FJsonValue>> TagArray;
		for (const FName& Tag : Actor->Tags)
		{
			TagArray.Add(MakeShared<FJsonValueString>(Tag.ToString()));
		}
		ActorObj->SetArrayField(TEXT("tags"), TagArray);

		ActorObj->SetBoolField(TEXT("hidden"), Actor->IsHidden());

		ActorArray.Add(MakeShared<FJsonValueObject>(ActorObj));
		Count++;
	}

	TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();
	Result->SetArrayField(TEXT("actors"), ActorArray);
	Result->SetNumberField(TEXT("count"), ActorArray.Num());
	if (!ClassFilter.IsEmpty())
		Result->SetStringField(TEXT("classFilter"), ClassFilter);
	if (!TagFilter.IsEmpty())
		Result->SetStringField(TEXT("tagFilter"), TagFilter);

	return JsonToString(Result);
}
