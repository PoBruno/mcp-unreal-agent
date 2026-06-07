#include "UnrealAgentServer.h"
#include "HAL/IConsoleManager.h"
#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Serialization/JsonWriter.h"
#include "Serialization/JsonSerializer.h"

// ============================================================
// HandleGetCVar — get a console variable value
// ============================================================

FString FUnrealAgentServer::HandleGetCVar(const FString& Body)
{
	TSharedPtr<FJsonObject> Json = ParseBodyJson(Body);
	if (!Json.IsValid())
	{
		return MakeErrorJson(TEXT("Invalid JSON body."));
	}

	FString Name;
	if (!Json->TryGetStringField(TEXT("name"), Name) || Name.IsEmpty())
	{
		return MakeErrorJson(TEXT("Missing required field: 'name' (console variable name)."));
	}

	UE_LOG(LogTemp, Display, TEXT("UnrealAgent: get_cvar('%s')"), *Name);

	IConsoleVariable* CVar = IConsoleManager::Get().FindConsoleVariable(*Name);
	if (!CVar)
	{
		return MakeErrorJson(FString::Printf(TEXT("Console variable '%s' not found. Use list_cvars to search."), *Name));
	}

	TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();
	Result->SetStringField(TEXT("name"), Name);
	Result->SetStringField(TEXT("value"), CVar->GetString());

	// Try to determine the type
	if (CVar->IsVariableInt())
	{
		Result->SetStringField(TEXT("type"), TEXT("int"));
		Result->SetNumberField(TEXT("intValue"), CVar->GetInt());
	}
	else if (CVar->IsVariableFloat())
	{
		Result->SetStringField(TEXT("type"), TEXT("float"));
		Result->SetNumberField(TEXT("floatValue"), CVar->GetFloat());
	}
	else
	{
		Result->SetStringField(TEXT("type"), TEXT("string"));
	}

	// Get help text
	FString Help = CVar->GetHelp();
	if (!Help.IsEmpty())
	{
		Result->SetStringField(TEXT("help"), Help);
	}

	return JsonToString(Result);
}

// ============================================================
// HandleSetCVar — set a console variable value
// ============================================================

FString FUnrealAgentServer::HandleSetCVar(const FString& Body)
{
	TSharedPtr<FJsonObject> Json = ParseBodyJson(Body);
	if (!Json.IsValid())
	{
		return MakeErrorJson(TEXT("Invalid JSON body."));
	}

	FString Name;
	if (!Json->TryGetStringField(TEXT("name"), Name) || Name.IsEmpty())
	{
		return MakeErrorJson(TEXT("Missing required field: 'name' (console variable name)."));
	}

	FString Value;
	if (!Json->TryGetStringField(TEXT("value"), Value))
	{
		// Try numeric value
		double NumValue = 0;
		if (Json->TryGetNumberField(TEXT("value"), NumValue))
		{
			Value = FString::SanitizeFloat(NumValue);
		}
		else
		{
			// Try bool value
			bool BoolValue = false;
			if (Json->TryGetBoolField(TEXT("value"), BoolValue))
			{
				Value = BoolValue ? TEXT("1") : TEXT("0");
			}
			else
			{
				return MakeErrorJson(TEXT("Missing required field: 'value'."));
			}
		}
	}

	UE_LOG(LogTemp, Display, TEXT("UnrealAgent: set_cvar('%s', '%s')"), *Name, *Value);

	IConsoleVariable* CVar = IConsoleManager::Get().FindConsoleVariable(*Name);
	if (!CVar)
	{
		return MakeErrorJson(FString::Printf(TEXT("Console variable '%s' not found. Use list_cvars to search."), *Name));
	}

	FString PreviousValue = CVar->GetString();
	CVar->Set(*Value, ECVF_SetByConsole);

	TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();
	Result->SetBoolField(TEXT("success"), true);
	Result->SetStringField(TEXT("name"), Name);
	Result->SetStringField(TEXT("previousValue"), PreviousValue);
	Result->SetStringField(TEXT("newValue"), CVar->GetString());

	return JsonToString(Result);
}

// ============================================================
// HandleListCVars — search/list console variables
// ============================================================

FString FUnrealAgentServer::HandleListCVars(const FString& Body)
{
	TSharedPtr<FJsonObject> Json = ParseBodyJson(Body);
	if (!Json.IsValid())
	{
		return MakeErrorJson(TEXT("Invalid JSON body."));
	}

	FString Filter;
	Json->TryGetStringField(TEXT("filter"), Filter);

	int32 MaxResults = 50;
	double MaxResultsDouble = 50;
	if (Json->TryGetNumberField(TEXT("maxResults"), MaxResultsDouble))
	{
		MaxResults = FMath::Clamp((int32)MaxResultsDouble, 1, 500);
	}

	UE_LOG(LogTemp, Display, TEXT("UnrealAgent: list_cvars(filter='%s', max=%d)"), *Filter, MaxResults);

	TArray<TSharedPtr<FJsonValue>> CVarArray;
	int32 TotalMatches = 0;

	IConsoleManager::Get().ForEachConsoleObjectThatStartsWith(
		FConsoleObjectVisitor::CreateLambda(
			[&](const TCHAR* Name, IConsoleObject* Object)
			{
				IConsoleVariable* CVar = Object->AsVariable();
				if (!CVar) return;

				FString NameStr(Name);

				// Apply filter if specified
				if (!Filter.IsEmpty() && !NameStr.Contains(Filter, ESearchCase::IgnoreCase))
				{
					return;
				}

				TotalMatches++;

				if (CVarArray.Num() >= MaxResults) return;

				TSharedRef<FJsonObject> CVarObj = MakeShared<FJsonObject>();
				CVarObj->SetStringField(TEXT("name"), NameStr);
				CVarObj->SetStringField(TEXT("value"), CVar->GetString());

				FString Help = CVar->GetHelp();
				if (!Help.IsEmpty())
				{
					// Truncate long help text
					if (Help.Len() > 200)
					{
						Help = Help.Left(200) + TEXT("...");
					}
					CVarObj->SetStringField(TEXT("help"), Help);
				}

				CVarArray.Add(MakeShared<FJsonValueObject>(CVarObj));
			}),
		TEXT(""));

	TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();
	Result->SetNumberField(TEXT("count"), CVarArray.Num());
	Result->SetNumberField(TEXT("totalMatches"), TotalMatches);
	Result->SetArrayField(TEXT("cvars"), CVarArray);
	if (!Filter.IsEmpty())
	{
		Result->SetStringField(TEXT("filter"), Filter);
	}

	return JsonToString(Result);
}
