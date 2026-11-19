extends CharacterBody3D

@export var controlled_by_player: bool = false
@export var walk_speed: float = 3.6
@export var sprint_multiplier: float = 1.35
@export var acceleration: float = 19.0
@export var braking: float = 25.0
@export var gravity_strength: float = 18.0
@export var turn_response: float = 11.0

var move_target: Vector3 = Vector3.ZERO
var route_points: Array[Vector3] = []
var route_index: int = 0
var has_move_target: bool = false
var gait_clock: float = 0.0
var active: bool = false
var animation_player: AnimationPlayer
var idle_animation: StringName = &""
var walk_animation: StringName = &""

@onready var visual_root: Node3D = get_node_or_null("VisualRoot")
@onready var left_leg: Node3D = get_node_or_null("VisualRoot/LeftLeg")
@onready var right_leg: Node3D = get_node_or_null("VisualRoot/RightLeg")
@onready var left_arm: Node3D = get_node_or_null("VisualRoot/LeftArm")
@onready var right_arm: Node3D = get_node_or_null("VisualRoot/RightArm")
@onready var torso: Node3D = get_node_or_null("VisualRoot/Torso")

func set_active(value: bool) -> void:
	active = value
	if not value:
		velocity.x = 0.0
		velocity.z = 0.0

func set_move_target(target: Vector3) -> void:
	set_move_route([target])

func set_move_route(points: Array[Vector3]) -> void:
	route_points = points.duplicate()
	route_index = 0
	has_move_target = not route_points.is_empty()
	if has_move_target:
		move_target = route_points.back()

func clear_move_target() -> void:
	has_move_target = false
	route_points.clear()
	route_index = 0

func set_animation_player(player: AnimationPlayer) -> void:
	animation_player = player
	idle_animation = _find_animation(["idle", "stand", "breath"])
	walk_animation = _find_animation(["walk", "run", "move"])

func _find_animation(terms: Array[String]) -> StringName:
	if animation_player == null:
		return &""
	for animation_name in animation_player.get_animation_list():
		var lowered := animation_name.to_lower()
		for term in terms:
			if lowered.contains(term):
				return StringName(animation_name)
	return &""

func _play_model_animation(moving: bool) -> bool:
	if animation_player == null:
		return false
	var clip := walk_animation if moving and walk_animation != &"" else idle_animation
	if clip == &"":
		return false
	if animation_player.current_animation != String(clip) or not animation_player.is_playing():
		animation_player.play(clip, 0.16)
	return true

func _physics_process(delta: float) -> void:
	var desired_direction := Vector3.ZERO
	var moving := false

	if not active:
		desired_direction = Vector3.ZERO
	elif controlled_by_player:
		var input_x := 0.0
		var input_z := 0.0
		if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
			input_x -= 1.0
		if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
			input_x += 1.0
		if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP):
			input_z -= 1.0
		if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN):
			input_z += 1.0
		desired_direction = Vector3(input_x, 0.0, input_z)
		moving = desired_direction.length_squared() > 0.001
		if moving:
			desired_direction = desired_direction.normalized()
	else:
		while has_move_target and route_index < route_points.size():
			var difference := route_points[route_index] - global_position
			difference.y = 0.0
			if difference.length() < 0.24:
				route_index += 1
				continue
			desired_direction = difference.normalized()
			moving = true
			break
		if route_index >= route_points.size():
			clear_move_target()

	var speed := walk_speed
	if controlled_by_player and Input.is_key_pressed(KEY_SHIFT):
		speed *= sprint_multiplier
	var target_velocity := desired_direction * speed
	var horizontal_velocity := Vector3(velocity.x, 0.0, velocity.z)
	var response := acceleration if moving else braking
	horizontal_velocity = horizontal_velocity.move_toward(target_velocity, response * delta)
	velocity.x = horizontal_velocity.x
	velocity.z = horizontal_velocity.z

	if not is_on_floor():
		velocity.y -= gravity_strength * delta
	else:
		velocity.y = -0.12

	move_and_slide()
	_update_animation(delta, moving, horizontal_velocity.length())

func _update_animation(delta: float, moving: bool, speed: float) -> void:
	if visual_root == null:
		return
	if _play_model_animation(moving and speed > 0.12):
		return
	if moving and speed > 0.12:
		gait_clock += delta * (5.2 + speed * 1.7)
		var stride := sin(gait_clock) * minf(0.6, speed / maxf(walk_speed, 0.1))
		if left_leg:
			left_leg.rotation.x = stride * 0.72
		if right_leg:
			right_leg.rotation.x = -stride * 0.72
		if left_arm:
			left_arm.rotation.x = -stride * 0.45
		if right_arm:
			right_arm.rotation.x = stride * 0.45
		visual_root.position.y = absf(sin(gait_clock * 2.0)) * 0.025
		if torso:
			torso.rotation.z = lerpf(torso.rotation.z, -stride * 0.035, 1.0 - exp(-delta * 8.0))
	else:
		gait_clock += delta
		var breathe := sin(gait_clock * 1.4) * 0.008
		visual_root.position.y = lerpf(visual_root.position.y, 0.0, 1.0 - exp(-delta * 8.0))
		if torso:
			torso.rotation.x = lerpf(torso.rotation.x, breathe, 1.0 - exp(-delta * 3.0))
		for limb in [left_leg, right_leg, left_arm, right_arm]:
			if limb:
				limb.rotation.x = lerpf(limb.rotation.x, 0.0, 1.0 - exp(-delta * 9.0))

	if moving and speed > 0.12:
		var direction := Vector3(velocity.x, 0.0, velocity.z).normalized()
		var desired_yaw := atan2(-direction.x, -direction.z)
		rotation.y = lerp_angle(rotation.y, desired_yaw, 1.0 - exp(-turn_response * delta))
