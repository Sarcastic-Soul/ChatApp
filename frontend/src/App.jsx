import React, { Suspense } from "react";
import { Navigate, Route, Routes } from "react-router";
import { useAuthContext } from "./context/AuthContext";
import { Box, Center, Loader } from "@mantine/core";

// Lazy loading pages for code splitting
const Home = React.lazy(() => import("./pages/Home"));
const Landing = React.lazy(() => import("./pages/Landing"));
const Login = React.lazy(() => import("./pages/Login"));
const SignUp = React.lazy(() => import("./pages/SignUp"));
const ProfilePage = React.lazy(() => import("./pages/Profile"));
const UserProfilePage = React.lazy(() => import("./pages/UserProfile"));
const GroupInfo = React.lazy(() => import("./pages/GroupInfo"));

function App() {
    const { authUser } = useAuthContext();

    return (
        <Box style={{ minHeight: "100dvh" }}>
            <Suspense fallback={<Center h="100dvh"><Loader size="md" type="dots" color="gray" /></Center>}>
            <Routes>
                <Route path="/" element={authUser ? <Home /> : <Landing />} />
                <Route
                    path="/login"
                    element={authUser ? <Navigate to="/" /> : <Login />}
                />
                <Route
                    path="/signup"
                    element={authUser ? <Navigate to="/" /> : <SignUp />}
                />
                <Route
                    path="/me"
                    element={
                        authUser ? <ProfilePage /> : <Navigate to={"/login"} />
                    }
                />
                <Route
                    path="/user/:username"
                    element={
                        authUser ? (
                            <UserProfilePage />
                        ) : (
                            <Navigate to={"/login"} />
                        )
                    }
                />
                <Route
                    path="/group/:groupId"
                    element={
                        authUser ? <GroupInfo /> : <Navigate to={"/login"} />
                    }
                />
            </Routes>
            </Suspense>
        </Box>
    );
}

import CallModal from "./components/call/CallModal";

const AppWithCallModal = () => (
    <>
        <CallModal />
        <App />
    </>
);

export default AppWithCallModal;
