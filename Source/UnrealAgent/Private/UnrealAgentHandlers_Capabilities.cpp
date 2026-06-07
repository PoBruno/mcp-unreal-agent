#include "UnrealAgentServer.h"
#include "Engine/Blueprint.h"
#include "Engine/SimpleConstructionScript.h"
#include "Engine/SCS_Node.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "AssetRegistry/ARFilter.h"
#include "Modules/ModuleManager.h"
#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Serialization/JsonWriter.h"
#include "Serialization/JsonSerializer.h"

// ============================================================
// HandleListAssets — generic asset browse via the Asset Registry.
// Fills the gap where only Blueprints/Materials had listing tools.
// ============================================================

FString FUnrealAgentServer::HandleListAssets(const FString& Body)
{
	TSharedPtr<FJsonObject> Json = ParseBodyJson(Body);

	FString ClassFilter, PathFilter;
	int32 Limit = 200;
	if (Json.IsValid())
	{
		Json->TryGetStringField(TEXT("classFilter"), ClassFilter);
		Json->TryGetStringField(TEXT("pathFilter"), PathFilter);
		double L = 0;
		if (Json->TryGetNumberField(TEXT("limit"), L) && L > 0) { Limit = FMath::Clamp((int32)L, 1, 1000); }
	}

	FAssetRegistryModule& ARM = FModuleManager::LoadModuleChecked<FAssetRegistryModule>("AssetRegistry");
	FARFilter Filter;
	Filter.bRecursivePaths = true;
	Filter.PackagePaths.Add(FName(TEXT("/Game")));

	TArray<FAssetData> Assets;
	ARM.Get().GetAssets(Filter, Assets);

	TArray<TSharedPtr<FJsonValue>> Arr;
	int32 Count = 0;
	int32 Total = 0;
	for (const FAssetData& A : Assets)
	{
		const FString Cls = A.AssetClassPath.GetAssetName().ToString();
		const FString ObjPath = A.GetObjectPathString();
		if (!ClassFilter.IsEmpty() && !Cls.Contains(ClassFilter)) { continue; }
		if (!PathFilter.IsEmpty() && !ObjPath.Contains(PathFilter)) { continue; }
		Total++;
		if (Count >= Limit) { continue; }
		TSharedRef<FJsonObject> O = MakeShared<FJsonObject>();
		O->SetStringField(TEXT("name"), A.AssetName.ToString());
		O->SetStringField(TEXT("path"), ObjPath);
		O->SetStringField(TEXT("class"), Cls);
		Arr.Add(MakeShared<FJsonValueObject>(O));
		Count++;
	}

	TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();
	Result->SetBoolField(TEXT("success"), true);
	Result->SetNumberField(TEXT("count"), Count);
	Result->SetNumberField(TEXT("total"), Total);
	if (Count < Total) { Result->SetStringField(TEXT("note"), FString::Printf(TEXT("%d of %d shown — narrow classFilter/pathFilter or raise limit"), Count, Total)); }
	Result->SetArrayField(TEXT("assets"), Arr);
	return JsonToString(Result);
}

// ============================================================
// HandleSetComponentDefault — set a default property on a Blueprint component
// template (components added via add_component / the Simple Construction Script).
// ============================================================

FString FUnrealAgentServer::HandleSetComponentDefault(const FString& Body)
{
	TSharedPtr<FJsonObject> Json = ParseBodyJson(Body);
	if (!Json.IsValid()) { return MakeErrorJson(TEXT("Invalid JSON body")); }

	FString BlueprintName = Json->GetStringField(TEXT("blueprint"));
	FString ComponentName = Json->GetStringField(TEXT("componentName"));
	FString PropertyName = Json->GetStringField(TEXT("property"));
	FString Value = Json->GetStringField(TEXT("value"));

	if (BlueprintName.IsEmpty() || ComponentName.IsEmpty() || PropertyName.IsEmpty())
	{
		return MakeErrorJson(TEXT("Missing required fields: blueprint, componentName, property"));
	}

	FString LoadError;
	UBlueprint* BP = LoadBlueprintByName(BlueprintName, LoadError);
	if (!BP) { return MakeErrorJson(LoadError); }
	if (!BP->SimpleConstructionScript)
	{
		return MakeErrorJson(TEXT("Blueprint has no construction script (no editable components)"));
	}

	UActorComponent* Template = nullptr;
	TArray<FString> Available;
	for (USCS_Node* Node : BP->SimpleConstructionScript->GetAllNodes())
	{
		if (!Node || !Node->ComponentTemplate) { continue; }
		const FString VarName = Node->GetVariableName().ToString();
		Available.Add(VarName);
		if (VarName == ComponentName) { Template = Node->ComponentTemplate; break; }
	}

	if (!Template)
	{
		TSharedRef<FJsonObject> Err = MakeShared<FJsonObject>();
		Err->SetStringField(TEXT("error"), FString::Printf(TEXT("Component '%s' not found (only SCS-added components are editable). Inherited components (e.g. Character Mesh) need python_exec."), *ComponentName));
		TArray<TSharedPtr<FJsonValue>> AvailArr;
		for (const FString& A : Available) { AvailArr.Add(MakeShared<FJsonValueString>(A)); }
		Err->SetArrayField(TEXT("availableComponents"), AvailArr);
		return JsonToString(Err);
	}

	FProperty* Prop = Template->GetClass()->FindPropertyByName(*PropertyName);
	if (!Prop)
	{
		return MakeErrorJson(FString::Printf(TEXT("Property '%s' not found on component '%s' (%s)"),
			*PropertyName, *ComponentName, *Template->GetClass()->GetName()));
	}

	Template->Modify();
	const TCHAR* ImportResult = Prop->ImportText_Direct(*Value, Prop->ContainerPtrToValuePtr<void>(Template), Template, PPF_None);
	if (!ImportResult)
	{
		return MakeErrorJson(FString::Printf(TEXT("Could not parse '%s' for property '%s' (type %s)"),
			*Value, *PropertyName, *Prop->GetCPPType()));
	}

	BP->Modify();
	const bool bSaved = SaveBlueprintPackage(BP);

	UE_LOG(LogTemp, Display, TEXT("UnrealAgent: set component default %s.%s.%s = '%s' (saved: %s)"),
		*BlueprintName, *ComponentName, *PropertyName, *Value, bSaved ? TEXT("true") : TEXT("false"));

	TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();
	Result->SetBoolField(TEXT("success"), true);
	Result->SetStringField(TEXT("blueprint"), BlueprintName);
	Result->SetStringField(TEXT("componentName"), ComponentName);
	Result->SetStringField(TEXT("property"), PropertyName);
	Result->SetStringField(TEXT("value"), Value);
	Result->SetBoolField(TEXT("saved"), bSaved);
	return JsonToString(Result);
}
