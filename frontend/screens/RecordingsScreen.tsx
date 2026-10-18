import { useState } from "react";
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
} from "react-native";

export default function RecordingsScreen() {
    const [saved, setSaved] =
        useState(false);

    const [processed, setProcessed] =
        useState(false);

    const [transcript, setTranscript] =
        useState(
            "Mama mala malú záhradu. V záhrade rástli kvety a stromy. Deti sa hrali na záhrade každý deň. Jana zbierala kvety pre mamu."
        );

    const wordCount = transcript
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;

    const saveRecording = () => {
        setSaved(true);

        Alert.alert(
            "Uložené",
            "Nahrávka bola úspešne uložená."
        );
    };

    const processRecording = () => {
        setProcessed(true);

        Alert.alert(
            "Spracovanie dokončené",
            "Analýza nahrávky bola úspešne dokončená."
        );
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
                    Jana Novotná · T01 · 0:47
                </Text>

                <TouchableOpacity
                    onPress={saveRecording}
                    style={{
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
                        {saved
                            ? "✅ Nahrávka uložená"
                            : "💾 Uložiť nahrávku"}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={processRecording}
                    style={{
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
                        {processed
                            ? "✅ Spracovanie dokončené"
                            : "⚙️ Uložiť a spracovať nahrávku"}
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
                            Upraviteľné
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
                            onChangeText={setTranscript}
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
                            Dĺžka nahrávky: 0:47
                        </Text>
                    </View>
                </View>

                {processed && (
                    <View
                        style={{
                            marginTop: 20,

                            backgroundColor: "#dcfce7",

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
                            Analýza pripravená na spracovanie.
                        </Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}