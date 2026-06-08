#include "UnrealAgentServer.h"
#include "Engine/Blueprint.h"
#include "EdGraph/EdGraph.h"
#include "EdGraph/EdGraphNode.h"
#include "Kismet2/BlueprintEditorUtils.h"
#include "Kismet2/KismetEditorUtilities.h"
#include "UObject/UnrealType.h"
#include "UObject/EnumProperty.h"
#include "UObject/TextProperty.h"
#include "UObject/Class.h"
#include "ScopedTransaction.h"
#include "HAL/PlatformTime.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonWriter.h"
#include "Serialization/JsonSerializer.h"

#define LOCTEXT_NAMESPACE "UnrealAgent"

// SEH wrapper defined in UnrealAgentServer.cpp
#if PLATFORM_WINDOWS
extern int32 TryCompileBlueprintSEH(UBlueprint* BP, EBlueprintCompileOptions Opts);
#endif

// ============================================================
// Shared helpers
// ============================================================

// Walk the per-node compiler flags into errors/warnings arrays. Returns error count.
static int32 CollectCompileMessages(
	UBlueprint* BP,
	TArray<TSharedPtr<FJsonValue>>& OutErrors,
	TArray<TSharedPtr<FJsonValue>>& OutWarnings,
	TArray<TSharedPtr<FJsonValue>>& OutErrorNodeIds)
{
	OutErrors.Reset();
	OutWarnings.Reset();
	OutErrorNodeIds.Reset();

	TArray<UEdGraph*> AllGraphs;
	BP->GetAllGraphs(AllGraphs);
	for (UEdGraph* Graph : AllGraphs)
	{
		if (!Graph) continue;
		for (UEdGraphNode* Node : Graph->Nodes)
		{
			if (!Node || !Node->bHasCompilerMessage) continue;

			TSharedRef<FJsonObject> Msg = MakeShared<FJsonObject>();
			Msg->SetStringField(TEXT("graph"), Graph->GetName());
			Msg->SetStringField(TEXT("nodeId"), Node->NodeGuid.ToString());
			Msg->SetStringField(TEXT("nodeTitle"), Node->GetNodeTitle(ENodeTitleType::FullTitle).ToString());
			Msg->SetStringField(TEXT("nodeClass"), Node->GetClass()->GetName());
			Msg->SetStringField(TEXT("message"), Node->ErrorMsg);

			if (Node->ErrorType == EMessageSeverity::Error)
			{
				Msg->SetStringField(TEXT("severity"), TEXT("error"));
				OutErrors.Add(MakeShared<FJsonValueObject>(Msg));
				OutErrorNodeIds.Add(MakeShared<FJsonValueString>(Node->NodeGuid.ToString()));
			}
			else
			{
				Msg->SetStringField(TEXT("severity"), TEXT("warning"));
				OutWarnings.Add(MakeShared<FJsonValueObject>(Msg));
			}
		}
	}
	return OutErrors.Num();
}

static FString BlueprintStatusString(EBlueprintStatus Status)
{
	switch (Status)
	{
		case BS_UpToDate:             return TEXT("UpToDate");
		case BS_UpToDateWithWarnings: return TEXT("UpToDateWithWarnings");
		case BS_Dirty:                return TEXT("Dirty");
		case BS_Error:                return TEXT("Error");
		case BS_Unknown:              return TEXT("Unknown");
		default:                      return FString::Printf(TEXT("Status_%d"), (int32)Status);
	}
}

// ============================================================
// HandleCompileBlueprint — first-class Compile with structured Compiler Results
// ============================================================

FString FUnrealAgentServer::HandleCompileBlueprint(const FString& Body)
{
	TSharedPtr<FJsonObject> Json = ParseBodyJson(Body);
	if (!Json.IsValid())
	{
		return MakeErrorJson(TEXT("Invalid JSON body"));
	}

	FString BlueprintName = Json->GetStringField(TEXT("blueprint"));
	if (BlueprintName.IsEmpty())
	{
		return MakeErrorJson(TEXT("Missing required field: blueprint"));
	}

	FString LoadError;
	UBlueprint* BP = LoadBlueprintByName(BlueprintName, LoadError);
	if (!BP)
	{
		return MakeErrorJson(LoadError);
	}

	const bool bSave        = Json->HasField(TEXT("save")) && Json->GetBoolField(TEXT("save"));
	const bool bRefresh     = Json->HasField(TEXT("refreshNodes")) && Json->GetBoolField(TEXT("refreshNodes"));
	const bool bRetryOnError = Json->HasField(TEXT("retryOnError")) && Json->GetBoolField(TEXT("retryOnError"));

	// "Refresh Nodes" first — fixes stale pins after upstream signature/struct changes.
	if (bRefresh)
	{
		FBlueprintEditorUtils::RefreshAllNodes(BP);
	}

	const EBlueprintCompileOptions Opts =
		EBlueprintCompileOptions::SkipSave |
		EBlueprintCompileOptions::SkipGarbageCollection |
		EBlueprintCompileOptions::SkipFiBSearchMetaUpdate;

	bool bCrashed = false;
	const double StartSeconds = FPlatformTime::Seconds();

#if PLATFORM_WINDOWS
	if (TryCompileBlueprintSEH(BP, Opts) != 0) { bCrashed = true; }
#else
	FKismetEditorUtilities::CompileBlueprint(BP, Opts, nullptr);
#endif

	TArray<TSharedPtr<FJsonValue>> ErrorsArr, WarningsArr, ErrorNodeIds;
	int32 ErrorCount = CollectCompileMessages(BP, ErrorsArr, WarningsArr, ErrorNodeIds);

	// Single auto-retry for transient cross-dependency errors (refresh then recompile).
	bool bRetried = false;
	if (bRetryOnError && ErrorCount > 0 && !bCrashed)
	{
		FBlueprintEditorUtils::RefreshAllNodes(BP);
#if PLATFORM_WINDOWS
		if (TryCompileBlueprintSEH(BP, Opts) != 0) { bCrashed = true; }
#else
		FKismetEditorUtilities::CompileBlueprint(BP, Opts, nullptr);
#endif
		ErrorCount = CollectCompileMessages(BP, ErrorsArr, WarningsArr, ErrorNodeIds);
		bRetried = true;
	}

	const double CompileTimeMs = (FPlatformTime::Seconds() - StartSeconds) * 1000.0;

	bool bSaved = false;
	if (bSave && ErrorCount == 0 && !bCrashed)
	{
		bSaved = SaveBlueprintPackage(BP);
	}

	const bool bNeedsSave = BP->GetOutermost() ? BP->GetOutermost()->IsDirty() : false;

	TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();
	Result->SetBoolField(TEXT("success"), ErrorCount == 0 && !bCrashed);
	Result->SetStringField(TEXT("blueprint"), BlueprintName);
	Result->SetStringField(TEXT("status"), BlueprintStatusString(BP->Status));
	Result->SetNumberField(TEXT("errorCount"), ErrorsArr.Num());
	Result->SetNumberField(TEXT("warningCount"), WarningsArr.Num());
	Result->SetArrayField(TEXT("errors"), ErrorsArr);
	Result->SetArrayField(TEXT("warnings"), WarningsArr);
	Result->SetArrayField(TEXT("errorNodeIds"), ErrorNodeIds);
	Result->SetNumberField(TEXT("compileTimeMs"), FMath::RoundToInt(CompileTimeMs));
	Result->SetBoolField(TEXT("needsSave"), bNeedsSave);
	Result->SetBoolField(TEXT("saved"), bSaved);
	if (bRetried) { Result->SetBoolField(TEXT("retried"), true); }
	if (bCrashed)
	{
		Result->SetBoolField(TEXT("crashed"), true);
		Result->SetStringField(TEXT("compileWarning"), TEXT("Compilation raised SEH exception; reload the asset before trusting reads"));
	}
	return JsonToString(Result);
}

// ============================================================
// Property reflection — describe a single FProperty + its value
// ============================================================

static TSharedRef<FJsonObject> DescribeProperty(FProperty* Prop, const void* Container, bool bRecurseStruct)
{
	TSharedRef<FJsonObject> Obj = MakeShared<FJsonObject>();
	Obj->SetStringField(TEXT("name"), Prop->GetName());
	Obj->SetStringField(TEXT("type"), Prop->GetCPPType());
	Obj->SetStringField(TEXT("propertyClass"), Prop->GetClass()->GetName());

#if WITH_EDITOR
	const FString Category = Prop->GetMetaData(TEXT("Category"));
	if (!Category.IsEmpty()) { Obj->SetStringField(TEXT("category"), Category); }
#endif

	Obj->SetBoolField(TEXT("editable"), Prop->HasAnyPropertyFlags(CPF_Edit));
	Obj->SetBoolField(TEXT("readOnly"),
		Prop->HasAnyPropertyFlags(CPF_EditConst) || Prop->HasAnyPropertyFlags(CPF_BlueprintReadOnly));

	// Current value
	FString Value;
	Prop->ExportTextItem_Direct(Value, Prop->ContainerPtrToValuePtr<void>(Container), nullptr, nullptr, PPF_None);
	Obj->SetStringField(TEXT("value"), Value);

	// Enum → the full set of allowed values (dropdown contents)
	UEnum* Enum = nullptr;
	if (FEnumProperty* EnumProp = CastField<FEnumProperty>(Prop)) { Enum = EnumProp->GetEnum(); }
	else if (FByteProperty* ByteProp = CastField<FByteProperty>(Prop)) { Enum = ByteProp->Enum; }
	if (Enum)
	{
		TArray<TSharedPtr<FJsonValue>> Allowed;
		const int32 Num = Enum->NumEnums();
		for (int32 i = 0; i < Num; ++i)
		{
			// Skip the trailing _MAX sentinel
			if (i == Num - 1 && Enum->ContainsExistingMax()) { continue; }
#if WITH_EDITOR
			if (Enum->HasMetaData(TEXT("Hidden"), i)) { continue; }
#endif
			Allowed.Add(MakeShared<FJsonValueString>(Enum->GetNameStringByIndex(i)));
		}
		Obj->SetArrayField(TEXT("allowedValues"), Allowed);
	}

	// Numeric range hints (slider + clamp)
#if WITH_EDITOR
	if (Prop->IsA<FNumericProperty>())
	{
		const TCHAR* Keys[] = { TEXT("UIMin"), TEXT("UIMax"), TEXT("ClampMin"), TEXT("ClampMax") };
		for (const TCHAR* Key : Keys)
		{
			const FString MetaVal = Prop->GetMetaData(Key);
			if (!MetaVal.IsEmpty()) { Obj->SetStringField(Key, MetaVal); }
		}
	}
#endif

	// Object/asset picker → the class filter
	if (FObjectPropertyBase* ObjProp = CastField<FObjectPropertyBase>(Prop))
	{
		if (ObjProp->PropertyClass)
		{
			Obj->SetStringField(TEXT("allowedClass"), ObjProp->PropertyClass->GetName());
		}
	}

	// One level of struct expansion (e.g. anim node's embedded FAnimNode_* struct)
	if (bRecurseStruct)
	{
		if (FStructProperty* StructProp = CastField<FStructProperty>(Prop))
		{
			const void* StructAddr = Prop->ContainerPtrToValuePtr<void>(Container);
			TArray<TSharedPtr<FJsonValue>> SubProps;
			for (TFieldIterator<FProperty> SubIt(StructProp->Struct); SubIt; ++SubIt)
			{
				SubProps.Add(MakeShared<FJsonValueObject>(DescribeProperty(*SubIt, StructAddr, false)));
			}
			Obj->SetArrayField(TEXT("subProperties"), SubProps);
		}
	}

	return Obj;
}

// ============================================================
// HandleGetNodeProperties — list ALL properties + values of a selected graph node
// ============================================================

FString FUnrealAgentServer::HandleGetNodeProperties(const FString& Body)
{
	TSharedPtr<FJsonObject> Json = ParseBodyJson(Body);
	if (!Json.IsValid())
	{
		return MakeErrorJson(TEXT("Invalid JSON body"));
	}

	FString BlueprintName = Json->GetStringField(TEXT("blueprint"));
	FString NodeId = Json->GetStringField(TEXT("nodeId"));
	if (BlueprintName.IsEmpty() || NodeId.IsEmpty())
	{
		return MakeErrorJson(TEXT("Missing required fields: blueprint, nodeId"));
	}

	FString Filter = Json->GetStringField(TEXT("filter"));
	const bool bEditableOnly = Json->HasField(TEXT("editableOnly")) && Json->GetBoolField(TEXT("editableOnly"));

	FString LoadError;
	UBlueprint* BP = LoadBlueprintByName(BlueprintName, LoadError);
	if (!BP) { return MakeErrorJson(LoadError); }

	UEdGraph* Graph = nullptr;
	UEdGraphNode* Node = FindNodeByGuid(BP, NodeId, &Graph);
	if (!Node)
	{
		return MakeErrorJson(FString::Printf(TEXT("Node '%s' not found in blueprint '%s'"), *NodeId, *BlueprintName));
	}

	TArray<TSharedPtr<FJsonValue>> PropList;
	for (TFieldIterator<FProperty> PropIt(Node->GetClass()); PropIt; ++PropIt)
	{
		FProperty* Prop = *PropIt;
		if (!Prop) continue;
		if (bEditableOnly && !Prop->HasAnyPropertyFlags(CPF_Edit)) continue;
		if (!Filter.IsEmpty() && !Prop->GetName().Contains(Filter, ESearchCase::IgnoreCase)) continue;

		PropList.Add(MakeShared<FJsonValueObject>(DescribeProperty(Prop, Node, /*bRecurseStruct*/ true)));
	}

	TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();
	Result->SetBoolField(TEXT("success"), true);
	Result->SetStringField(TEXT("blueprint"), BlueprintName);
	Result->SetStringField(TEXT("nodeId"), NodeId);
	Result->SetStringField(TEXT("nodeTitle"), Node->GetNodeTitle(ENodeTitleType::FullTitle).ToString());
	Result->SetStringField(TEXT("nodeClass"), Node->GetClass()->GetName());
	if (Graph) { Result->SetStringField(TEXT("graph"), Graph->GetName()); }
	Result->SetStringField(TEXT("nodeComment"), Node->NodeComment);
	Result->SetNumberField(TEXT("count"), PropList.Num());
	Result->SetArrayField(TEXT("properties"), PropList);
	return JsonToString(Result);
}

// ============================================================
// HandleSetNodeProperty — edit any property on a graph node (supports Struct.SubProp paths)
// ============================================================

FString FUnrealAgentServer::HandleSetNodeProperty(const FString& Body)
{
	TSharedPtr<FJsonObject> Json = ParseBodyJson(Body);
	if (!Json.IsValid())
	{
		return MakeErrorJson(TEXT("Invalid JSON body"));
	}

	FString BlueprintName = Json->GetStringField(TEXT("blueprint"));
	FString NodeId = Json->GetStringField(TEXT("nodeId"));
	FString PropertyName = Json->GetStringField(TEXT("propertyName"));
	FString NewValue = Json->GetStringField(TEXT("value"));
	if (BlueprintName.IsEmpty() || NodeId.IsEmpty() || PropertyName.IsEmpty())
	{
		return MakeErrorJson(TEXT("Missing required fields: blueprint, nodeId, propertyName"));
	}

	FString LoadError;
	UBlueprint* BP = LoadBlueprintByName(BlueprintName, LoadError);
	if (!BP) { return MakeErrorJson(LoadError); }

	UEdGraph* Graph = nullptr;
	UEdGraphNode* Node = FindNodeByGuid(BP, NodeId, &Graph);
	if (!Node)
	{
		return MakeErrorJson(FString::Printf(TEXT("Node '%s' not found in blueprint '%s'"), *NodeId, *BlueprintName));
	}

	// Resolve the property path (supports one level of struct nesting: "Node.PlayRate").
	TArray<FString> Parts;
	PropertyName.ParseIntoArray(Parts, TEXT("."));
	void* CurContainer = Node;
	UStruct* CurStruct = Node->GetClass();
	FProperty* Prop = nullptr;
	void* ValuePtr = nullptr;
	for (int32 i = 0; i < Parts.Num(); ++i)
	{
		Prop = FindFProperty<FProperty>(CurStruct, *Parts[i]);
		if (!Prop)
		{
			return MakeErrorJson(FString::Printf(TEXT("Property '%s' not found on '%s'"), *Parts[i], *CurStruct->GetName()));
		}
		ValuePtr = Prop->ContainerPtrToValuePtr<void>(CurContainer);
		if (i < Parts.Num() - 1)
		{
			FStructProperty* StructProp = CastField<FStructProperty>(Prop);
			if (!StructProp)
			{
				return MakeErrorJson(FString::Printf(TEXT("Property '%s' is not a struct; cannot descend"), *Parts[i]));
			}
			CurContainer = ValuePtr;
			CurStruct = StructProp->Struct;
		}
	}

	if (Prop->HasAnyPropertyFlags(CPF_EditConst))
	{
		return MakeErrorJson(FString::Printf(TEXT("Property '%s' is read-only (EditConst)"), *PropertyName));
	}

	FScopedTransaction Transaction(LOCTEXT("SetNodeProperty", "Set node property"));
	Node->Modify();

	const TCHAR* ImportResult = Prop->ImportText_Direct(*NewValue, ValuePtr, Node, PPF_None);
	if (ImportResult == nullptr)
	{
		Transaction.Cancel();
		return MakeErrorJson(FString::Printf(TEXT("Failed to parse value '%s' for property '%s' (%s)"),
			*NewValue, *PropertyName, *Prop->GetCPPType()));
	}

	// Refresh the node so changed config reflects on its pins, then mark for recompile.
	Node->ReconstructNode();
	FBlueprintEditorUtils::MarkBlueprintAsStructurallyModified(BP);

	const bool bSave = Json->HasField(TEXT("save")) && Json->GetBoolField(TEXT("save"));
	bool bSaved = false;
	if (bSave)
	{
		FKismetEditorUtilities::CompileBlueprint(BP, EBlueprintCompileOptions::SkipGarbageCollection);
		bSaved = SaveBlueprintPackage(BP);
	}

	// Re-export the value that actually stuck.
	FString ActualValue;
	Prop->ExportTextItem_Direct(ActualValue, ValuePtr, nullptr, Node, PPF_None);

	TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();
	Result->SetBoolField(TEXT("success"), true);
	Result->SetStringField(TEXT("blueprint"), BlueprintName);
	Result->SetStringField(TEXT("nodeId"), NodeId);
	Result->SetStringField(TEXT("propertyName"), PropertyName);
	Result->SetStringField(TEXT("value"), ActualValue);
	Result->SetBoolField(TEXT("saved"), bSaved);
	return JsonToString(Result);
}

#undef LOCTEXT_NAMESPACE
