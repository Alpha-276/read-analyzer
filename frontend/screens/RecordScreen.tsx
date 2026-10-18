import { useEffect, useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
} from "react-native";

type RecordScreenProps = {
    setCurrentScreen: (screen: string) => void;
};

export default function RecordScreen({
                                         setCurrentScreen,
                                     }: RecordScreenProps){
    const students = [
        "Jana Novotná",
        "Peter Kováč",
        "Mária Horváthová",
    ];

    const texts = ["T01", "T02", "T03", "T04"];

    const [selectedStudent, setSelectedStudent] =
        useState("Jana Novotná");

    const [selectedText, setSelectedText] =
        useState("T01");

    const [showStudents, setShowStudents] =
        useState(false);

    const [showTexts, setShowTexts] =
        useState(false);

    const [isRecording, setIsRecording] =
        useState(false);

    const [status, setStatus] =
        useState("Pripravené");

    const [seconds, setSeconds] =
        useState(0);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;

        if (isRecording) {
            interval = setInterval(() => {
                setSeconds((prev) => prev + 1);
            }, 1000);
        }

        return () => {
            if (interval) {
                clearInterval(interval);
            }
        };
    }, [isRecording]);

    const formatTime = () => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;

        return `${String(mins).padStart(
            2,
            "0"
        )}:${String(secs).padStart(
            2,
            "0"
        )}`;
    };

    const handleRecording = () => {
        if (!isRecording) {
            setIsRecording(true);
            setStatus("Nahráva sa...");
            return;
        }

        setIsRecording(false);
        setStatus("Dokončené");
    };

    const resetRecording = () => {
        setIsRecording(false);
        setStatus("Pripravené");
        setSeconds(0);
    };

    const continueRecording = () => {
        setCurrentScreen("recordings");
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
                        onPress={() =>
                            setShowStudents(!showStudents)
                        }
                        style={{
                            backgroundColor: "#eef2ff",
                            borderRadius: 14,
                            padding: 16,
                            marginBottom: 8,
                            flexDirection: "row",
                            justifyContent: "space-between",
                        }}
                    >
                        <Text>{selectedStudent}</Text>
                        <Text>⌄</Text>
                    </TouchableOpacity>

                    {showStudents &&
                        students.map((student) => (
                            <TouchableOpacity
                                key={student}
                                onPress={() => {
                                    setSelectedStudent(student);
                                    setShowStudents(false);
                                }}
                                style={{
                                    padding: 12,
                                    borderBottomWidth: 1,
                                    borderBottomColor: "#e2e8f0",
                                }}
                            >
                                <Text>{student}</Text>
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
                        onPress={() =>
                            setShowTexts(!showTexts)
                        }
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
                                        : status === "Dokončené"
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
                            : "Kliknite na tlačidlo pre spustenie nahrávania"}
                    </Text>

                    {status === "Dokončené" && (
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