import { useEffect, useState } from 'react';
import {useAuthContext} from '../context/AuthContext';

const useGetUserDetails = () => {
    const [userDetails, setUserDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
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
                const data = await res.json();

                if (data.error) {
                    throw new Error(data.error);
                }
                setUserDetails(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        getUserDetails();
    }, [authUser]);

    return { userDetails, loading, error };
};

export default useGetUserDetails;
