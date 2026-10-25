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
    TextInput,
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

    // The transcription comes only from the ASR server, not the demo text.
    const transcript = recording?.transcript ?? "";
    const wordCount = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;

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
                    : "Prepis nahrávky je dokončený."
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
                    ČítamDobre
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
                        fontSize: 30,
                        fontWeight: "700",
                        color: "#0f172a",
                        marginBottom: 4,
                    }}
                >
                    Spracovanie nahrávky
                </Text>

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
                        {resuming ? "⏳ Obnovuje sa spracovanie..."
                            : action === "process" ? "⏳ Spracúva sa..."
                            : recording?.processingStatus === "done" ? "✅ Prepis dokončený"
                            : saved ? "🔄 Spracovať nahrávku" : "⚙️ Uložiť a spracovať nahrávku"}
                    </Text>
                </TouchableOpacity>

                <View
                    style={{
                        backgroundColor: "white",

                        borderRadius: 22,

                        padding: 16,

                        shadowColor: "#000",
                        shadowOpacity: 0.06,
                        shadowRadius: 8,

                        elevation: 3,
                    }}
                >
                    <View
                        style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            marginBottom: 16,
                        }}
                    >
                        <Text
                            style={{
                                color: "#94a3b8",
                                fontWeight: "700",
                                letterSpacing: 1,
                                fontSize: 12,
                            }}
                        >
                            PREPIS TEXTU
                        </Text>

                        <Text
                            style={{
                                color: "#94a3b8",
                                fontSize: 12,
                            }}
                        >
                            {recording?.processingStatus === "done" ? "Výsledok ASR" : "Zatiaľ nedostupný"}
                        </Text>
                    </View>

                    <View
                        style={{
                            backgroundColor: "#eef2ff",

                            borderRadius: 16,

                            padding: 16,

                            minHeight: 180,
                        }}
                    >
                        <TextInput
                            multiline
                            value={transcript}
                            editable={false}
                            placeholder="Prepis sa zobrazí po spracovaní nahrávky."
                            textAlignVertical="top"
                            style={{
                                minHeight: 140,
                                color: "#1e293b",
                                lineHeight: 24,
                            }}
                        />
                    </View>

                    <View
                        style={{
                            flexDirection: "row",
                            justifyContent: "space-between",

                            marginTop: 16,
                        }}
                    >
                        <Text
                            style={{
                                color: "#64748b",
                                fontSize: 12,
                            }}
                        >
                            {wordCount} slov
                        </Text>

                        <Text
                            style={{
                                color: "#64748b",
                                fontSize: 12,
                            }}
                        >
                            Dĺžka nahrávky: {recording?.durationSeconds ?? 0} s
                        </Text>
                    </View>
                </View>

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
                                ? "Prepis bol dokončený."
                                : recording?.processingStatus === "processing"
                                    ? "Prebieha rozpoznávanie reči..."
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