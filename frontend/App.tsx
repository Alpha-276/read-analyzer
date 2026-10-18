import { useEffect, useState } from "react";
import { View } from "react-native";

import HomeScreen from "./screens/HomeScreen";
import ClassScreen from "./screens/ClassScreen";
import RecordScreen from "./screens/RecordScreen";
import RecordingsScreen from "./screens/RecordingsScreen";
import AnalysisScreen from "./screens/AnalysisScreen";

import BottomNavigation from "./components/BottomNavigation";

import { initializeDatabase } from "./services";


export default function App() {
    const [currentScreen, setCurrentScreen] =
        useState("home");

    useEffect(() => {
        initializeDatabase()
            .then(() =>
                console.log("Database initialized")
            )
            .catch(console.error);
    }, []);

    const renderScreen = () => {


        switch (currentScreen) {
            case "class":
                return <ClassScreen />;

            case "record":
                return (
                    <RecordScreen
                        setCurrentScreen={setCurrentScreen}
                    />
                );

            case "recordings":
                return <RecordingsScreen />;

            case "analysis":
                return <AnalysisScreen />;

            default:
                return (
                    <HomeScreen
                        setCurrentScreen={setCurrentScreen}
                    />
                );
        }
    };

    return (
        <View
            style={{
                flex: 1,
            }}
        >
            <View
                style={{
                    flex: 1,
                }}
            >
                {renderScreen()}
            </View>

            <BottomNavigation
                setCurrentScreen={setCurrentScreen}
            />
        </View>
    );
}