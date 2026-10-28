import { useRef, useState } from "react";

import {
    saveRecording as saveLocalRecording,
    saveAndProcess,
    type WavRecording,
} from "../services";

import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Alert,
} from "react-native";



type RecordingsScreenProps = {
    recording: WavRecording | null;
    onRecordingChange: (recording: WavRecording) => void;
    resuming?: boolean;
};

export default function RecordingsScreen({ recording, onRecordingChange, resuming = false }: RecordingsScreenProps) {
    const saved = recording?.status === "saved";
    const confirmingRef = useRef(false);
    const [action, setAction] = useState<"save" | "process" | null>(null);

    const runAction = async (kind: "save" | "process") => {
        if (!recording || confirmingRef.current) return;
        confirmingRef.current = true;
        setAction(kind);
        try {
            const result = kind === "save"
                ? await saveLocalRecording(recording, onRecordingChange)
                : await saveAndProcess(recording, onRecordingChange);
            onRecordingChange(result);
            Alert.alert(
                kind === "save" ? "Uložené" : "Hotovo",
                kind === "save"
                    ? "Nahrávka je uložená v Download/CitamDobre/deti/."
                    : "Nahrávka bola odoslaná na server."
            );
        } catch (error) {
            Alert.alert("Chyba", error instanceof Error ? error.message : String(error));
        } finally {
            confirmingRef.current = false;
            setAction(null);
        }
    };

    const saveRecording = () => void runAction("save");
    const processRecording = () => void runAction("process");
    const isSaving = action !== null || resuming;

    return (
        <View
            style={{
                flex: 1,
                backgroundColor: "#f1f5f9",
            }}
        >
            <View
                style={{
                    backgroundColor: "#3b82f6",
                    paddingTop: 45,
                    paddingBottom: 20,
                    alignItems: "center",
                }}
            >
                <Text
                    style={{
                        color: "white",
                        fontSize: 24,
                        fontWeight: "700",
                    }}
                >
                    Spracovanie nahrávky
                </Text>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                    padding: 16,
                    paddingBottom: 60,
                }}
            >
                <Text
                    style={{
                        color: "#64748b",
                        marginBottom: 25,
                    }}
                >
                    {recording
                        ? `${recording.student.firstName} ${recording.student.lastName} · ${recording.textId} · ${recording.durationSeconds} s`
                        : "Zatiaľ nie je vybraná uložená nahrávka"}
                </Text>

                <TouchableOpacity
                    onPress={saveRecording}
                    disabled={!recording || saved || isSaving}
                    style={{
                        opacity: !recording || saved || isSaving ? 0.6 : 1,
                        backgroundColor: "white",
                        borderWidth: 1.5,
                        borderColor: "#3b82f6",

                        borderRadius: 18,

                        padding: 18,

                        alignItems: "center",

                        marginBottom: 12,
                    }}
                >
                    <Text
                        style={{
                            color: "#3b82f6",
                            fontWeight: "700",
                        }}
                    >
                        {recording
                            ? (saved ? "✅ WAV uložený" : action === "save" ? "⏳ Ukladá sa..." : "💾 Uložiť nahrávku")
                            : "💾 Žiadna WAV nahrávka"}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={processRecording}
                    disabled={!recording || isSaving || recording?.processingStatus === "done"}
                    style={{
                        opacity: !recording || isSaving || recording?.processingStatus === "done" ? 0.6 : 1,
                        backgroundColor: "#3b82f6",

                        borderRadius: 18,

                        padding: 18,

                        alignItems: "center",

                        marginBottom: 20,

                        shadowColor: "#3b82f6",
                        shadowOpacity: 0.2,
                        shadowRadius: 8,

                        elevation: 5,
                    }}
                >
                    <Text
                        style={{
                            color: "white",
                            fontWeight: "700",
                        }}
                    >
                        {resuming ? "⏳ Dokončuje sa spracovanie..."
                            : action === "process" ? "⏳ Odosiela sa na server..."
                            : recording?.processingStatus === "done" ? "✅ Nahrávka odoslaná"
                            : "📤 Odoslať nahrávku na server"}
                    </Text>
                </TouchableOpacity>

                {saved && (
                    <View
                        style={{
                            marginTop: 20,

                            backgroundColor: recording?.processingStatus === "done" ? "#dcfce7" : "#e2e8f0",

                            borderRadius: 16,

                            padding: 16,
                        }}
                    >
                        <Text
                            style={{
                                color: "#166534",
                                fontWeight: "700",
                            }}
                        >
                            {recording?.processingStatus === "done"
                                ? "Nahrávka bola odoslaná na server."
                                : recording?.processingStatus === "processing"
                                    ? "Prebieha spracovanie na serveri..."
                                    : recording?.processingStatus === "pending"
                                        ? "Čaká sa na spracovanie..."
                                        : recording?.processingStatus === "error"
                                            ? "Spracovanie nahrávky zlyhalo."
                                            : "Nahrávka zatiaľ nie je spracovaná."}
                        </Text>
                        {!!recording?.processingError && (
                            <Text style={{ marginTop: 8, color: "#b91c1c" }}>
                                {recording.processingError} — WAV zostal v telefóne. Skúste spracovanie znova.
                            </Text>
                        )}
                    </View>
                )}
            </ScrollView>
        </View>
    );
}