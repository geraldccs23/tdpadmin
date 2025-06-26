import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '../types';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSessionAndProfile = async () => {
      const { data: authData } = await supabase.auth.getSession();
      const supabaseUser = authData.session?.user;

      if (supabaseUser) {
        // Intenta cargar el perfil desde la tabla "users"
        let { data: profile, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', supabaseUser.id)
          .maybeSingle(); // 🔁 No lanza error si no existe

        if (!profile) {
          // No existe: creamos el perfil con rol por defecto
          const { error: insertError } = await supabase
            .from('users')
            .insert({
              id: supabaseUser.id,
              email: supabaseUser.email,
              full_name: supabaseUser.user_metadata?.full_name ?? '',
              role: 'cajero' // 🔐 Cambiá según tu lógica
            });

          if (insertError) {
            console.error('Error creando perfil de usuario:', insertError);
            setUser(null);
            setLoading(false);
            return;
          }

          // Reintentamos cargar el perfil después de crearlo
          const { data: newProfile } = await supabase
            .from('users')
            .select('*')
            .eq('id', supabaseUser.id)
            .single();

          profile = newProfile;
        }

        setUser({
          id: supabaseUser.id,
          email: supabaseUser.email,
          fullName: profile.full_name,
          role: profile.role,
          assigned_store_id: profile.assigned_store_id,
          permissions: profile.permissions ?? []
        });
      } else {
        setUser(null);
      }

      setLoading(false);
    };

    getSessionAndProfile();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null);
        setLoading(false);
        return;
      }

      const loadProfile = async () => {
        const supabaseUser = session.user;

        let { data: profile, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', supabaseUser.id)
          .maybeSingle();

        if (!profile) {
          const { error: insertError } = await supabase
            .from('users')
            .insert({
              id: supabaseUser.id,
              email: supabaseUser.email,
              full_name: supabaseUser.user_metadata?.full_name ?? '',
              role: 'cajero'
            });

          if (insertError) {
            console.error('Error creando perfil de usuario (auth change):', insertError);
            setUser(null);
            setLoading(false);
            return;
          }

          const { data: newProfile } = await supabase
            .from('users')
            .select('*')
            .eq('id', supabaseUser.id)
            .single();

          profile = newProfile;
        }

        setUser({
          id: supabaseUser.id,
          email: supabaseUser.email,
          fullName: profile.full_name,
          role: profile.role,
          assigned_store_id: profile.assigned_store_id,
          permissions: profile.permissions ?? []
        });

        setLoading(false);
      };

      loadProfile();
    });

    return () => {
      listener?.subscription?.unsubscribe();
    };
  }, []);

  // Sign in
  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  };

  // Sign up
  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }
      }
    });
    return { data, error };
  };

  // Sign out
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  return {
    user,
    loading,
    signIn,
    signUp,
    signOut
  };
};
