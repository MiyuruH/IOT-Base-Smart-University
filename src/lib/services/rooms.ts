import { supabase } from "@/lib/supabase";
import {
  buildLiveRoomStatus,
  getLatestByRoom,
} from "@/lib/services/latestSensorData";

export async function getRooms(building_id?: string) {
  let query = supabase
    .from("rooms")
    .select("*, room_status(*), sensor_nodes(node_id, is_active)")
    .order("created_at", { ascending: false });

  if (building_id) {
    query = query.eq("building_id", building_id);
  }

  const { data, error } = await query;
  if (error) throw error;

  if (!data || data.length === 0) return data;

  const roomIds = data.map((r: { room_id: string }) => r.room_id);
  const latestByRoom = await getLatestByRoom(roomIds);

  return data.map((room: { room_id: string; room_status: unknown }) => {
    const latest = latestByRoom[room.room_id];
    const status = Array.isArray(room.room_status)
      ? room.room_status[0]
      : room.room_status;
    const merged = buildLiveRoomStatus(
      status as Record<string, unknown> | undefined,
      latest
    );

    return {
      ...room,
      room_status: merged,
    };
  });
}

export async function getRoomById(room_id: string) {
  const { data, error } = await supabase
    .from("rooms")
    .select("*, room_status(*), sensor_nodes(*)")
    .eq("room_id", room_id)
    .single();

  if (error) throw error;

  const latestByRoom = await getLatestByRoom([room_id]);
  const latest = latestByRoom[room_id];
  const status = Array.isArray(data.room_status)
    ? data.room_status[0]
    : data.room_status;
  const merged = buildLiveRoomStatus(
    status as Record<string, unknown> | undefined,
    latest
  );

  return {
    ...data,
    room_status: merged,
  };
}

export async function createRoom(input: {
  name: string;
  code?: string;
  type: string;
  building_id: string;
  floor_id?: string;
  is_public_destination?: boolean;
}) {
  const { data, error } = await supabase
    .from("rooms")
    .insert(input)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateRoom(
  room_id: string,
  updates: {
    name?: string;
    code?: string;
    type?: string;
    building_id?: string;
    floor_id?: string | null;
    is_public_destination?: boolean;
  }
) {
  const { data, error } = await supabase
    .from("rooms")
    .update(updates)
    .eq("room_id", room_id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteRoom(room_id: string) {
  const { error } = await supabase
    .from("rooms")
    .delete()
    .eq("room_id", room_id);

  if (error) throw error;
}

export async function getRoomStatus(room_id: string) {
  const { data, error } = await supabase
    .from("room_status")
    .select("*")
    .eq("room_id", room_id)
    .maybeSingle();

  if (error) throw error;

  const base = data ?? {
    room_id,
    occupancy: null,
    temperature_c: null,
    light_lux: null,
    noise_db: null,
    ghost_cooling_active: null,
    ghost_cooling_level: null,
    ghost_cooling_reason: null,
    updated_at: null,
    last_reading_id: null,
  };

  const latestByRoom = await getLatestByRoom([room_id]);
  return buildLiveRoomStatus(base, latestByRoom[room_id]);
}
