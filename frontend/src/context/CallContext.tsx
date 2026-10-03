import type { ReactNode } from "react";
import { CallContext } from "./useCallContext";
import useCallSession from "../hooks/useCallSession";

// The call logic lives in useCallSession. The context object and the
// useCallContext hook live in useCallContext.ts.
export const CallContextProvider = ({ children }: { children: ReactNode }) => {
    const callSession = useCallSession();

    return (
        <CallContext.Provider value={callSession}>
            {children}
        </CallContext.Provider>
    );
};
