extends Node

signal action_result(success: bool, message: String)

@export var prisoner: CharacterBody3D
@export var arena_min: Vector2 = Vector2(-11.0, -8.0)
@export var arena_max: Vector2 = Vector2(13.0, 8.0)

func apply_json_response(raw_text: String) -> bool:
	var parsed: Variant = JSON.parse_string(raw_text)
	if not parsed is Dictionary:
		action_result.emit(false, "AI response must be a JSON object.")
		return false

	var action: Variant = parsed.get("action", parsed)
	if not action is Dictionary:
		action_result.emit(false, "AI response is missing an action object.")
		return false

	var action_type := str(action.get("type", "")).to_lower()
	match action_type:
		"move":
			if prisoner == null:
				action_result.emit(false, "Prisoner body is not available.")
				return false
			var x := float(action.get("x", INF))
			var z := float(action.get("z", INF))
			if not is_finite(x) or not is_finite(z):
				action_result.emit(false, "Move action requires finite x and z coordinates.")
				return false
			if x < arena_min.x or x > arena_max.x or z < arena_min.y or z > arena_max.y:
				action_result.emit(false, "Move target is outside the prison perimeter.")
				return false
			prisoner.call("set_move_target", Vector3(x, prisoner.global_position.y, z))
			action_result.emit(true, "Prisoner received a validated movement target.")
			return true
		"wait":
			if prisoner:
				prisoner.call("clear_move_target")
			action_result.emit(true, "Prisoner waits and observes.")
			return true
		"inspect", "interact", "use_item", "speak":
			action_result.emit(false, "This action is recognised but its native interaction is not implemented yet.")
			return false
		_:
			action_result.emit(false, "Unsupported action type: %s" % action_type)
			return false
