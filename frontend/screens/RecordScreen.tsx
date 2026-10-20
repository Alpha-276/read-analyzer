import { useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    AppState,
    Alert,
} from "react-native";
import {
    listClasses,
    listStudents,
    startRecording,
    stopRecording,
    discardPendingRecording,
    type Student,
    type WavRecording,
} from "../services";

type RecordScreenProps = {
    setCurrentScreen: (screen: string) => void;
    onRecordingChange: (recording: WavRecording | null) => void;
};

export default function RecordScreen({ setCurrentScreen, onRecordingChange }: RecordScreenProps) {
    const [students, setStudents] = useState<Student[]>([]);
    const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
    const [selectedText, setSelectedText] = useState("T01");
    const texts = ["T01", "T02", "T03", "T04"];
    const [showStudents, setShowStudents] = useState(false);
    const [showTexts, setShowTexts] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isBusy, setIsBusy] = useState(false);
    const [savedUri, setSavedUri] = useState<string | null>(null);
    const [status, setStatus] = useState("Pripravené");
    const [seconds, setSeconds] = useState(0);
    const secondsRef = useRef(0);
    const activeSessionRef = useRef<{ student: Student; textId: string } | null>(null);
    const operationBusyRef = useRef(false);
    const finalizeRef = useRef<() => Promise<void>>(async () => {});
    const unmountedRef = useRef(false);

    const selectedStudent = students.find(s => s.id === selectedStudentId) ?? null;

    // Data comes from RA-7, not from a hard-coded demo array.
    useEffect(() => {
        let cancelled = false;
        async function load() {
            try {
                const classes = await listClasses();
                const groups = await Promise.all(classes.map(c => listStudents(c.id)));
                const allStudents = groups.flat();
                if (cancelled) return;
                setStudents(allStudents);
                setSelectedStudentId(old =>
                    allStudents.some(s => s.id === old) ? old : (allStudents[0]?.id ?? null)
                );
            } catch (error) {
                console.error(error);
                Alert.alert("Chyba", "Nepodarilo sa načítať žiakov.");
            }
        }
        void load();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (!isRecording) return;
        const interval = setInterval(() => {
            secondsRef.current += 1;
            setSeconds(secondsRef.current);
        }, 1000);
        return () => clearInterval(interval);
    }, [isRecording]);

    // Stop also when the app goes into the background or user leaves this screen.
    useEffect(() => {
        unmountedRef.current = false;
        const subscription = AppState.addEventListener("change", nextState => {
            if (nextState !== "active" && activeSessionRef.current) {
                void finalizeRef.current();
            }
        });
        return () => {
            unmountedRef.current = true;
            subscription.remove();
            if (activeSessionRef.current) void finalizeRef.current();
        };
    }, []);

    const formatTime = () => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    };

    const finalize = async () => {
        const current = activeSessionRef.current;
        if (!current || operationBusyRef.current) return;
        operationBusyRef.current = true;
        if (!unmountedRef.current) setIsBusy(true);
        try {
            const uri = await stopRecording();
            activeSessionRef.current = null;
            console.log("WAV TEMPORARY:", uri);
            onRecordingChange({ uri, student: current.student, textId: current.textId,
                durationSeconds: secondsRef.current, status: "pending" });
            if (!unmountedRef.current) {
                setIsRecording(false);
                setSavedUri(uri);
                setStatus("Pripravené na uloženie");
            }
        } catch (error) {
            console.error(error);
            if (!unmountedRef.current) {
                setIsRecording(false);
                setStatus("Chyba nahrávania");
                Alert.alert("Chyba", error instanceof Error ? error.message : String(error));
            }
            activeSessionRef.current = null;
        } finally {
            operationBusyRef.current = false;
            if (!unmountedRef.current) setIsBusy(false);
        }
    };
    finalizeRef.current = finalize;

    const handleRecording = async () => {
        if (operationBusyRef.current) return;
        if (activeSessionRef.current) {
            await finalize();
            return;
        }
        if (!selectedStudent) {
            Alert.alert("Žiak", "Najprv vyberte žiaka.");
            return;
        }

        operationBusyRef.current = true;
        setIsBusy(true);
        try {
            // The new recording replaces any earlier, unconfirmed preview.
            discardPendingRecording();
            onRecordingChange(null);
            secondsRef.current = 0;
            setSeconds(0);
            setSavedUri(null);
            await startRecording({ student: selectedStudent, textId: selectedText, sampleRate: 16000 });
            activeSessionRef.current = { student: selectedStudent, textId: selectedText };
            if (!unmountedRef.current) {
                setIsRecording(true);
                setStatus("Nahráva sa...");
            } else {
                // Permission prompt may finish after screen unmounts.
                void stopRecording().then(uri => {
                    onRecordingChange({ uri, student: selectedStudent, textId: selectedText,
                        durationSeconds: secondsRef.current, status: "pending" });
                    activeSessionRef.current = null;
                }).catch(console.error);
            }
        } catch (error) {
            console.error(error);
            if (!unmountedRef.current) {
                setStatus("Chyba nahrávania");
                Alert.alert("Chyba", error instanceof Error ? error.message : String(error));
            }
        } finally {
            operationBusyRef.current = false;
            if (!unmountedRef.current) setIsBusy(false);
        }
    };

    const resetRecording = () => {
        try {
            // Only the unconfirmed .wav.part is removed; saved WAVs remain untouched.
            discardPendingRecording();
            onRecordingChange(null);
            setIsRecording(false);
            setStatus("Pripravené");
            setSavedUri(null);
            secondsRef.current = 0;
            setSeconds(0);
        } catch (error) {
            Alert.alert("Chyba", error instanceof Error ? error.message : String(error));
        }
    };

    const continueRecording = () => {
        if (savedUri) setCurrentScreen("recordings");
    };

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
                        marginBottom: 6,
                    }}
                >
                    Nahrávanie čítania
                </Text>

                <Text
                    style={{
                        color: "#64748b",
                        marginBottom: 20,
                    }}
                >
                    {new Date().toLocaleDateString("sk-SK")}
                </Text>

                <View
                    style={{
                        backgroundColor: "white",
                        borderRadius: 22,
                        padding: 16,
                        marginBottom: 20,
                        shadowColor: "#000",
                        shadowOpacity: 0.06,
                        shadowRadius: 8,
                        elevation: 3,
                    }}
                >
                    <Text
                        style={{
                            color: "#94a3b8",
                            fontSize: 12,
                            fontWeight: "700",
                            marginBottom: 8,
                        }}
                    >
                        VÝBER DIEŤAŤA
                    </Text>

                    <TouchableOpacity
                        onPress={() => { if (!isRecording && !isBusy) setShowStudents(!showStudents); }}
                        style={{
                            backgroundColor: "#eef2ff",
                            borderRadius: 14,
                            padding: 16,
                            marginBottom: 8,
                            flexDirection: "row",
                            justifyContent: "space-between",
                        }}
                    >
                        <Text>{selectedStudent ? `${selectedStudent.firstName} ${selectedStudent.lastName}` : "Vyberte žiaka"}</Text>
                        <Text>⌄</Text>
                    </TouchableOpacity>

                    {showStudents &&
                        students.map((student) => (
                            <TouchableOpacity
                                key={student.id}
                                onPress={() => {
                                    setSelectedStudentId(student.id);
                                    setShowStudents(false);
                                }}
                                style={{
                                    padding: 12,
                                    borderBottomWidth: 1,
                                    borderBottomColor: "#e2e8f0",
                                }}
                            >
                                <Text>{student.firstName} {student.lastName}</Text>
                            </TouchableOpacity>
                        ))}

                    <Text
                        style={{
                            color: "#94a3b8",
                            fontSize: 12,
                            fontWeight: "700",
                            marginTop: 20,
                            marginBottom: 8,
                        }}
                    >
                        KÓD TEXTU
                    </Text>

                    <TouchableOpacity
                        onPress={() => { if (!isRecording && !isBusy) setShowTexts(!showTexts); }}
                        style={{
                            backgroundColor: "#eef2ff",
                            borderRadius: 14,
                            padding: 16,
                            flexDirection: "row",
                            justifyContent: "space-between",
                        }}
                    >
                        <Text>{selectedText}</Text>
                        <Text>⌄</Text>
                    </TouchableOpacity>

                    {showTexts &&
                        texts.map((text) => (
                            <TouchableOpacity
                                key={text}
                                onPress={() => {
                                    setSelectedText(text);
                                    setShowTexts(false);
                                }}
                                style={{
                                    padding: 12,
                                    borderBottomWidth: 1,
                                    borderBottomColor: "#e2e8f0",
                                }}
                            >
                                <Text>{text}</Text>
                            </TouchableOpacity>
                        ))}
                </View>

                <View
                    style={{
                        backgroundColor: "white",
                        borderRadius: 22,
                        padding: 24,
                        alignItems: "center",
                        shadowColor: "#000",
                        shadowOpacity: 0.06,
                        shadowRadius: 8,
                        elevation: 3,
                    }}
                >
                    <View
                        style={{
                            backgroundColor: "#f1f5f9",
                            borderRadius: 20,
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                            marginBottom: 30,
                        }}
                    >
                        <Text
                            style={{
                                color:
                                    status === "Nahráva sa..."
                                        ? "#ef4444"
                                        : status === "Pripravené na uloženie"
                                            ? "#22c55e"
                                            : "#64748b",
                                fontWeight: "600",
                            }}
                        >
                            {status}
                        </Text>
                    </View>

                    <Text
                        style={{
                            color: "#cbd5e1",
                            fontSize: 20,
                            letterSpacing: 2,
                            marginBottom: 25,
                        }}
                    >
                        ▂▃▅▃▂▂▅▅▃▂▃▅▂▂▃▅▃▂
                    </Text>

                    <Text
                        style={{
                            fontSize: 48,
                            fontWeight: "700",
                            color: isRecording
                                ? "#ef4444"
                                : "#94a3b8",
                            marginBottom: 25,
                        }}
                    >
                        {formatTime()}
                    </Text>

                    <TouchableOpacity
                        onPress={handleRecording}
                        disabled={isBusy || (!selectedStudent && !activeSessionRef.current)}
                        style={{
                            width: 90,
                            height: 90,
                            borderRadius: 45,
                            backgroundColor: isRecording
                                ? "#dc2626"
                                : "#ef4444",
                            justifyContent: "center",
                            alignItems: "center",
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 34,
                                color: "white",
                            }}
                        >
                            {isRecording ? "⏹" : "🎙️"}
                        </Text>
                    </TouchableOpacity>

                    <Text
                        style={{
                            marginTop: 20,
                            color: "#94a3b8",
                            textAlign: "center",
                        }}
                    >
                        {isRecording
                            ? "Nahrávanie prebieha..."
                            : status === "Pripravené na uloženie"
                                ? "Pokračujte pre kontrolu WAV alebo nahrajte znova"
                                : "Kliknite na tlačidlo pre spustenie nahrávania"}
                    </Text>

                    {status === "Pripravené na uloženie" && (
                        <View
                            style={{
                                flexDirection: "row",
                                width: "100%",
                                marginTop: 20,
                                justifyContent: "space-between",
                            }}
                        >
                            <TouchableOpacity
                                onPress={continueRecording}
                                style={{
                                    flex: 1,
                                    backgroundColor: "#2563eb",
                                    padding: 14,
                                    borderRadius: 14,
                                    alignItems: "center",
                                }}
                            >
                                <Text
                                    style={{
                                        color: "white",
                                        fontWeight: "700",
                                    }}
                                >
                                    Pokračovať →
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={resetRecording}
                                style={{
                                    flex: 1,
                                    backgroundColor: "#fef2f2",
                                    padding: 14,
                                    borderRadius: 14,
                                    alignItems: "center",
                                }}
                            >
                                <Text
                                    style={{
                                        color: "#dc2626",
                                        fontWeight: "700",
                                    }}
                                >
                                    Nahrať znova
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}