export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
          role: "parent" | "player" | "coach" | "admin";
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      parent_player_relationships: {
        Row: {
          id: string;
          parent_id: string;
          player_id: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["parent_player_relationships"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["parent_player_relationships"]["Insert"]>;
      };
      coach_availability: {
        Row: {
          id: string;
          coach_id: string;
          slot_date: string;
          slot_time: string;
          is_available: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["coach_availability"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["coach_availability"]["Insert"]>;
      };
      individual_session_bookings: {
        Row: {
          id: string;
          coach_id: string;
          player_id: string;
          parent_id: string;
          session_type_id: string;
          coach_availability_id: string;
          booking_date: string;
          booking_time: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["individual_session_bookings"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["individual_session_bookings"]["Insert"]>;
      };
      session_types: {
        Row: { id: string; name: string; duration_minutes: number; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["session_types"]["Row"], "created_at"> & { created_at?: string };
        Update: Partial<Database["public"]["Tables"]["session_types"]["Insert"]>;
      };
      group_reservations: {
        Row: {
          id: string;
          player_id: string;
          group_session_id: string;
          status: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["group_reservations"]["Row"], "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["group_reservations"]["Insert"]>;
      };
      group_sessions: {
        Row: {
          id: string;
          title: string | null;
          session_date: string;
          session_time: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
      };
      sessions: {
        Row: {
          id: string;
          coach_id: string;
          type: string;
          starts_at: string;
          ends_at: string;
          capacity: number;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["sessions"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sessions"]["Insert"]>;
      };
    };
    Functions: {
      book_individual_session: {
        Args: {
          p_coach_id: string;
          p_player_id: string;
          p_parent_id: string;
          p_session_type_id: string;
          p_booking_date: string;
          p_booking_time: string;
        };
        Returns: { booking_id: string; error_message: string | null };
      };
    };
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ParentPlayerRelationship = Database["public"]["Tables"]["parent_player_relationships"]["Row"];
export type CoachAvailability = Database["public"]["Tables"]["coach_availability"]["Row"];
export type IndividualSessionBooking = Database["public"]["Tables"]["individual_session_bookings"]["Row"];
export type SessionType = Database["public"]["Tables"]["session_types"]["Row"];
export type GroupReservation = Database["public"]["Tables"]["group_reservations"]["Row"];
