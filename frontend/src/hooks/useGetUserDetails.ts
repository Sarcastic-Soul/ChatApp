import { useEffect, useState } from 'react';
import {useAuthContext} from '../context/useAuthContext';
import { errorMessage } from '../utils/errorMessage';
import type { ApiError, User } from '../types';

const useGetUserDetails = () => {
    const [userDetails, setUserDetails] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { authUser } = useAuthContext();

    useEffect(() => {
        const getUserDetails = async () => {
            if (!authUser || !authUser._id) {
                setError("User not authenticated.");
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/users/${authUser.username}`);
                const data = (await res.json()) as User & ApiError;

                if (data.error) {
                    throw new Error(data.error);
                }
                setUserDetails(data);
            } catch (err) {
                setError(errorMessage(err));
            } finally {
                setLoading(false);
            }
        };

        getUserDetails();
    }, [authUser]);

    return { userDetails, loading, error };
};

export default useGetUserDetails;
