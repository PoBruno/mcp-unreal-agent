#include "UnrealAgentServer.h"
#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Serialization/JsonWriter.h"
#include "Serialization/JsonSerializer.h"
#include "IPythonScriptPlugin.h"
#include "PythonScriptTypes.h"

// ============================================================
// HandlePythonExec — run a Python statement/script in the editor and return
// its captured output (R-05). Unlike exec_command("py ..."), this captures the
// Python log/print output and the evaluated result.
// ============================================================

FString FUnrealAgentServer::HandlePythonExec(const FString& Body)
{
	TSharedPtr<FJsonObject> Json = ParseBodyJson(Body);
	if (!Json.IsValid())
	{
		return MakeErrorJson(TEXT("Invalid JSON body."));
	}

	FString Command;
	if (!Json->TryGetStringField(TEXT("command"), Command) || Command.IsEmpty())
	{
		return MakeErrorJson(TEXT("Missing required field: 'command'."));
	}

	if (!bIsEditor)
	{
		return MakeErrorJson(TEXT("python_exec requires editor mode."));
	}

	IPythonScriptPlugin* Py = IPythonScriptPlugin::Get();
	if (!Py || !Py->IsPythonAvailable())
	{
		return MakeErrorJson(TEXT("Python is not available (enable the Python Editor Script Plugin)."));
	}

	// Evaluate single expressions so a value comes back in CommandResult; fall back
	// to statement execution (assignments, multi-line) which still captures prints.
	FPythonCommandEx PyCmd;
	PyCmd.Command = Command;
	PyCmd.ExecutionMode = Command.Contains(TEXT("\n")) || Command.Contains(TEXT("="))
		? EPythonCommandExecutionMode::ExecuteStatement
		: EPythonCommandExecutionMode::EvaluateStatement;

	const bool bSuccess = Py->ExecPythonCommandEx(PyCmd);

	FString Output;
	TArray<TSharedPtr<FJsonValue>> LogArr;
	for (const FPythonLogOutputEntry& Entry : PyCmd.LogOutput)
	{
		Output += Entry.Output;
		if (!Entry.Output.EndsWith(TEXT("\n"))) { Output += TEXT("\n"); }

		TSharedRef<FJsonObject> L = MakeShared<FJsonObject>();
		L->SetStringField(TEXT("type"), Entry.Type == EPythonLogOutputType::Error ? TEXT("error") : TEXT("info"));
		L->SetStringField(TEXT("output"), Entry.Output);
		LogArr.Add(MakeShared<FJsonValueObject>(L));
	}

	TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();
	Result->SetBoolField(TEXT("success"), bSuccess);
	Result->SetStringField(TEXT("command"), Command);
	Result->SetStringField(TEXT("result"), PyCmd.CommandResult);
	Result->SetStringField(TEXT("output"), Output);
	Result->SetArrayField(TEXT("log"), LogArr);
	return JsonToString(Result);
}
