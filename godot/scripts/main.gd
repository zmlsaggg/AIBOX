extends Node3D

const CharacterMotorScript = preload("res://scripts/character_motor.gd")
const SecurityDoorScript = preload("res://scripts/security_door.gd")
const PhysicsItemScript = preload("res://scripts/physics_item.gd")
const AmbientCameraScript = preload("res://scripts/ambient_camera.gd")
const AITurnControllerScript = preload("res://scripts/ai_turn_controller.gd")
const RoutePlannerScript = preload("res://scripts/route_planner.gd")

var guard: CharacterBody3D
var prisoner: CharacterBody3D
var ai_controller: Node
var route_planner: Node
var held_item: RigidBody3D
var doors: Array[AnimatableBody3D] = []
var security_cameras: Array[Node3D] = []
var hired_guards: Array[CharacterBody3D] = []
var budget: int = 1400
var camera_count: int = 4
var turn_count: int = 0
var shift_started: bool = false
var alarm_active: bool = false
var event_label: Label
var budget_label: Label
var camera_label: Label
var guard_label: Label
var turn_label: Label
var status_label: Label
var intro_overlay: ColorRect
var start_overlay: ColorRect
var difficulty_select: OptionButton
var ui_root: Control

var floor_material: StandardMaterial3D
var wall_material: StandardMaterial3D
var dark_wall_material: StandardMaterial3D
var metal_material: StandardMaterial3D
var guard_material: StandardMaterial3D
var prisoner_material: StandardMaterial3D
var alarm_light: OmniLight3D

func _ready() -> void:
	_create_materials()
	_create_world_environment()
	_build_prison()
	_build_actors()
	_build_physics_items()
	_build_security_cameras()
	_build_ui()
	guard.call("set_active", false)
	prisoner.call("set_active", false)
	route_planner = RoutePlannerScript.new()
	route_planner.name = "RoutePlanner"
	add_child(route_planner)
	await get_tree().physics_frame
	_rebuild_navigation()
	var route_smoke: Dictionary = route_planner.call(
		"find_route",
		prisoner.global_position,
		prisoner.global_position + Vector3(-1.0, 0.0, 0.0)
	)
	if not route_smoke.get("ok", false):
		push_error("AIBOX NAVIGATION SMOKE FAILED: %s" % str(route_smoke.get("reason", "No route")))
	else:
		print("AIBOX NAVIGATION SMOKE OK: %s waypoint(s)." % str(route_smoke.get("waypoint_count", 0)))

	ai_controller = AITurnControllerScript.new()
	ai_controller.prisoner = prisoner
	ai_controller.route_planner = route_planner
	ai_controller.action_result.connect(_on_ai_action_result)
	add_child(ai_controller)

func _create_materials() -> void:
	floor_material = _material(Color("#343e3c"), 0.92)
	wall_material = _material(Color("#596461"), 0.93)
	dark_wall_material = _material(Color("#25302f"), 0.9)
	metal_material = _material(Color("#7b8986"), 0.48, 0.58)
	guard_material = _material(Color("#435e69"), 0.76)
	prisoner_material = _material(Color("#9a7957"), 0.78)

func _material(color: Color, roughness: float, metallic: float = 0.0) -> StandardMaterial3D:
	var result := StandardMaterial3D.new()
	result.albedo_color = color
	result.roughness = roughness
	result.metallic = metallic
	return result

func _create_world_environment() -> void:
	var world_environment := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("#0b1113")
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("#9daea7")
	environment.ambient_light_energy = 0.52
	environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	environment.glow_enabled = true
	environment.glow_intensity = 0.22
	world_environment.environment = environment
	add_child(world_environment)

	var key_light := DirectionalLight3D.new()
	key_light.rotation_degrees = Vector3(-53.0, -31.0, 0.0)
	key_light.light_color = Color("#e2d2b6")
	key_light.light_energy = 0.72
	key_light.shadow_enabled = true
	key_light.directional_shadow_max_distance = 38.0
	add_child(key_light)

	for index in range(5):
		var light := OmniLight3D.new()
		light.position = Vector3(-9.0 + float(index) * 4.5, 3.2, -5.7 if index < 3 else 5.8)
		light.omni_range = 7.2
		light.light_energy = 1.55
		light.light_color = Color("#d5c6a8")
		light.shadow_enabled = index == 1 or index == 3
		add_child(light)

	alarm_light = OmniLight3D.new()
	alarm_light.position = Vector3(0.0, 3.0, 0.0)
	alarm_light.omni_range = 15.0
	alarm_light.light_color = Color("#e14e48")
	alarm_light.light_energy = 0.0
	alarm_light.shadow_enabled = false
	add_child(alarm_light)

func _build_prison() -> void:
	_add_static_box("Concrete floor", Vector3(0, -0.25, 0), Vector3(24, 0.5, 18), floor_material)
	_add_static_box("North outer wall", Vector3(0, 1.5, -9), Vector3(24, 3, 0.42), wall_material)
	_add_static_box("South outer wall", Vector3(0, 1.5, 9), Vector3(24, 3, 0.42), wall_material)
	_add_static_box("West outer wall", Vector3(-12, 1.5, 0), Vector3(0.42, 3, 18), wall_material)
	_add_static_box("East wall upper", Vector3(12, 1.5, -5.5), Vector3(0.42, 3, 7), wall_material)
	_add_static_box("East wall lower", Vector3(12, 1.5, 5.5), Vector3(0.42, 3, 7), wall_material)
	_add_door("Outer perimeter gate", Vector3(11.78, 0.0, 0.0), Vector3(0.18, 2.5, 2.2), 90.0)

	# Cell-block divider with real gaps for animated doors.
	_add_static_box("Divider west", Vector3(-10.35, 1.35, -1.35), Vector3(3.3, 2.7, 0.28), dark_wall_material)
	_add_static_box("Divider west middle", Vector3(-4.35, 1.35, -1.35), Vector3(5.3, 2.7, 0.28), dark_wall_material)
	_add_static_box("Divider east middle", Vector3(4.2, 1.35, -1.35), Vector3(5.0, 2.7, 0.28), dark_wall_material)
	_add_static_box("Divider east", Vector3(10.45, 1.35, -1.35), Vector3(3.1, 2.7, 0.28), dark_wall_material)
	_add_door("West cell door", Vector3(-8.0, 0.0, -1.35), Vector3(1.45, 2.45, 0.16), 92.0)
	_add_door("Center cell door", Vector3(0.0, 0.0, -1.35), Vector3(1.45, 2.45, 0.16), 92.0)
	_add_door("East cell door", Vector3(8.0, 0.0, -1.35), Vector3(1.45, 2.45, 0.16), 92.0)

	# Vertical partitions create distinct cells and an open guard corridor.
	_add_static_box("West cell partition", Vector3(-6.4, 1.2, -5.15), Vector3(0.22, 2.4, 6.8), dark_wall_material)
	_add_static_box("East cell partition", Vector3(6.4, 1.2, -5.15), Vector3(0.22, 2.4, 6.8), dark_wall_material)
	_add_static_box("Central secure partition", Vector3(0.0, 1.2, 4.6), Vector3(0.2, 2.4, 8.7), dark_wall_material)

	# Furniture is collidable, so actors and loose props cannot clip through it.
	_add_static_box("West bunk frame", Vector3(-9.7, 0.32, -6.0), Vector3(1.8, 0.38, 0.85), metal_material)
	_add_static_box("West bunk mattress", Vector3(-9.7, 0.57, -6.0), Vector3(1.7, 0.14, 0.78), _material(Color("#77817a"), 0.96))
	_add_static_box("East bunk frame", Vector3(9.5, 0.32, -6.0), Vector3(1.8, 0.38, 0.85), metal_material)
	_add_static_box("East bunk mattress", Vector3(9.5, 0.57, -6.0), Vector3(1.7, 0.14, 0.78), _material(Color("#77817a"), 0.96))
	_add_static_box("Control desk", Vector3(-4.8, 0.75, 5.7), Vector3(2.2, 1.5, 0.85), dark_wall_material)
	_add_static_box("Storage cabinet", Vector3(9.8, 0.9, 6.7), Vector3(0.85, 1.8, 0.65), metal_material)

	# Reinforced windows with visible bars on the outer walls.
	_add_window(Vector3(-8.2, 1.85, -8.77), Vector2(2.25, 1.05), false)
	_add_window(Vector3(8.2, 1.85, -8.77), Vector2(2.25, 1.05), false)
	_add_window(Vector3(-11.77, 1.8, -4.4), Vector2(1.9, 1.0), true)

	# A worn tile rhythm gives the large concrete floor scale.
	for x in range(-10, 11, 2):
		_add_visual_box("Floor seam", Vector3(float(x), 0.008, 0), Vector3(0.018, 0.012, 18), _material(Color("#202a29"), 1.0))
	for z in range(-8, 9, 2):
		_add_visual_box("Floor seam", Vector3(0, 0.01, float(z)), Vector3(24, 0.012, 0.018), _material(Color("#202a29"), 1.0))

func _add_static_box(label: String, position: Vector3, size: Vector3, material: Material) -> StaticBody3D:
	var body := StaticBody3D.new()
	body.name = label
	body.position = position
	var mesh_instance := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh_instance.mesh = mesh
	mesh_instance.material_override = material
	body.add_child(mesh_instance)
	var collision := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	collision.shape = shape
	body.add_child(collision)
	add_child(body)
	return body

func _add_visual_box(label: String, position: Vector3, size: Vector3, material: Material) -> MeshInstance3D:
	var mesh_instance := MeshInstance3D.new()
	mesh_instance.name = label
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh_instance.mesh = mesh
	mesh_instance.material_override = material
	mesh_instance.position = position
	add_child(mesh_instance)
	return mesh_instance

func _add_door(label: String, position: Vector3, size: Vector3, open_angle: float) -> AnimatableBody3D:
	var door := AnimatableBody3D.new()
	door.name = label
	door.set_script(SecurityDoorScript)
	door.set("open_angle_degrees", open_angle)
	door.position = position
	var mesh_instance := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh_instance.mesh = mesh
	mesh_instance.material_override = metal_material
	door.add_child(mesh_instance)
	var collision := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	collision.shape = shape
	door.add_child(collision)
	add_child(door)
	doors.append(door)
	return door

func _add_window(position: Vector3, dimensions: Vector2, side_wall: bool) -> void:
	var frame_size := Vector3(0.12, dimensions.y + 0.18, dimensions.x + 0.18)
	if not side_wall:
		frame_size = Vector3(dimensions.x + 0.18, dimensions.y + 0.18, 0.12)
	var frame := _add_visual_box("Window steel frame", position, frame_size, metal_material)
	if side_wall:
		frame.rotation.y = PI / 2.0
	var glass_material := _material(Color(0.28, 0.39, 0.39, 0.35), 0.2, 0.1)
	glass_material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	var glass_size := Vector3(0.025, dimensions.y, dimensions.x)
	if not side_wall:
		glass_size = Vector3(dimensions.x, dimensions.y, 0.025)
	var glass := _add_visual_box("Frosted window", position, glass_size, glass_material)
	if side_wall:
		glass.rotation.y = PI / 2.0
	for index in range(7):
		var offset := -dimensions.x * 0.42 + float(index) / 6.0 * dimensions.x * 0.84
		var bar_position := position + (Vector3(0, 0, offset) if side_wall else Vector3(offset, 0, 0))
		var bar_size := Vector3(0.045, dimensions.y + 0.05, 0.055)
		if side_wall:
			bar_size = Vector3(0.055, dimensions.y + 0.05, 0.045)
		_add_visual_box("Window bars", bar_position, bar_size, metal_material)

func _build_actors() -> void:
	guard = _create_actor("Warden", Vector3(-4.7, 0.0, 6.5), guard_material, true)
	prisoner = _create_actor("Prisoner", Vector3(-9.25, 0.0, -3.7), prisoner_material, false)
	_create_camera_rig()

func _create_actor(label: String, position: Vector3, material: StandardMaterial3D, player_controlled: bool) -> CharacterBody3D:
	var actor := CharacterBody3D.new()
	actor.name = label
	actor.set_script(CharacterMotorScript)
	actor.set("controlled_by_player", player_controlled)
	actor.position = position
	actor.floor_snap_length = 0.2
	actor.floor_max_angle = deg_to_rad(48.0)
	actor.safe_margin = 0.035
	var collision := CollisionShape3D.new()
	var capsule_shape := CapsuleShape3D.new()
	capsule_shape.radius = 0.32
	capsule_shape.height = 1.76
	collision.shape = capsule_shape
	collision.position.y = 0.88
	actor.add_child(collision)

	var visual := Node3D.new()
	visual.name = "VisualRoot"
	actor.add_child(visual)

	var is_guard := label.to_lower().contains("guard") or label.to_lower() == "warden"
	var model_path := "res://assets/characters/guard.glb" if is_guard else "res://assets/characters/prisoner.glb"
	if ResourceLoader.exists(model_path):
		var packed_model := load(model_path) as PackedScene
		if packed_model:
			var model := packed_model.instantiate()
			model.name = "RiggedCharacter"
			# Ara exports humanoids +Y-up and facing +Z; the tactical controller faces -Z.
			model.rotation.y = PI
			visual.add_child(model)
			var imported_skeleton := _find_skeleton(model)
			if imported_skeleton:
				actor.call("set_skeleton", imported_skeleton)
			var imported_animation := _find_animation_player(model)
			if imported_animation and not imported_animation.get_animation_list().is_empty():
				actor.call("set_animation_player", imported_animation)
	else:
		_add_actor_capsule(visual, "Torso", 0.25, 0.78, Vector3(0, 0.98, 0), material)
		var skin_material := _material(Color("#c8a084"), 0.92)
		var head_mesh := SphereMesh.new()
		head_mesh.radius = 0.17
		head_mesh.height = 0.34
		var head := MeshInstance3D.new()
		head.name = "Head"
		head.mesh = head_mesh
		head.material_override = skin_material
		head.position = Vector3(0, 1.54, -0.015)
		visual.add_child(head)
		var dark_material := _material(Color("#202a2b"), 0.82)
		_add_actor_capsule(visual, "LeftLeg", 0.085, 0.53, Vector3(-0.12, 0.4, 0), dark_material)
		_add_actor_capsule(visual, "RightLeg", 0.085, 0.53, Vector3(0.12, 0.4, 0), dark_material)
		_add_actor_capsule(visual, "LeftArm", 0.07, 0.62, Vector3(-0.29, 1.0, 0), material)
		_add_actor_capsule(visual, "RightArm", 0.07, 0.62, Vector3(0.29, 1.0, 0), material)
	actor.add_to_group("navigation_actors")
	add_child(actor)
	return actor

func _find_skeleton(node: Node) -> Skeleton3D:
	if node is Skeleton3D:
		return node as Skeleton3D
	for child in node.get_children():
		var found := _find_skeleton(child)
		if found:
			return found
	return null

func _find_animation_player(node: Node) -> AnimationPlayer:
	if node is AnimationPlayer:
		return node as AnimationPlayer
	for child in node.get_children():
		var found := _find_animation_player(child)
		if found:
			return found
	return null

func _add_actor_capsule(parent: Node3D, label: String, radius: float, height: float, position: Vector3, material: Material) -> MeshInstance3D:
	var mesh := CapsuleMesh.new()
	mesh.radius = radius
	mesh.height = height
	var instance := MeshInstance3D.new()
	instance.name = label
	instance.mesh = mesh
	instance.material_override = material
	instance.position = position
	parent.add_child(instance)
	return instance

func _create_camera_rig() -> void:
	var camera_rig := Node3D.new()
	camera_rig.name = "TacticalCamera"
	camera_rig.position = Vector3(0, 22, 18)
	camera_rig.rotation_degrees.x = -51.0
	add_child(camera_rig)
	var camera := Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 25.5
	camera.near = 0.1
	camera.far = 100.0
	camera.position = Vector3.ZERO
	camera_rig.add_child(camera)
	camera.current = true

func _rebuild_navigation() -> void:
	if route_planner == null:
		return
	var excluded: Array[RID] = []
	for character in get_tree().get_nodes_in_group("navigation_actors"):
		if character is CollisionObject3D:
			excluded.append(character.get_rid())
	for item in get_tree().get_nodes_in_group("pickup_items"):
		if item is CollisionObject3D:
			excluded.append(item.get_rid())
	route_planner.call("rebuild", excluded)

func get_ai_navigation_briefing() -> Dictionary:
	if route_planner == null or prisoner == null:
		return {"reachable": [], "blocked": []}
	var targets: Array[Dictionary] = []
	for item in get_tree().get_nodes_in_group("pickup_items"):
		if item is RigidBody3D and item != held_item:
			targets.append({
				"id": str(item.get("item_id")),
				"kind": "item",
				"x": item.global_position.x,
				"z": item.global_position.z,
			})
	for door in doors:
		targets.append({
			"id": door.name,
			"kind": "door",
			"x": door.global_position.x,
			"z": door.global_position.z,
		})
	return route_planner.call("get_reachable_options", prisoner.global_position, targets)

func _build_physics_items() -> void:
	_create_item("keycard", "Security keycard", Vector3(-8.0, 1.0, -3.2), Color("#4e9a92"), Vector3(0.16, 0.04, 0.1))
	_create_item("wrench", "Steel wrench", Vector3(-4.0, 1.2, 3.8), Color("#9da9a2"), Vector3(0.32, 0.055, 0.075))
	_create_item("canteen", "Metal canteen", Vector3(3.6, 1.2, 3.2), Color("#9a805f"), Vector3(0.16, 0.22, 0.16))

func _create_item(item_id: StringName, label: String, position: Vector3, color: Color, size: Vector3) -> void:
	var item := RigidBody3D.new()
	item.name = label
	item.set_script(PhysicsItemScript)
	item.set("item_id", item_id)
	item.set("display_name", label)
	item.position = position
	var material := _material(color, 0.42, 0.3)
	var mesh_instance := MeshInstance3D.new()
	if item_id == &"wrench":
		var mesh := BoxMesh.new()
		mesh.size = size
		mesh_instance.mesh = mesh
	else:
		var mesh := BoxMesh.new()
		mesh.size = size
		mesh_instance.mesh = mesh
	mesh_instance.material_override = material
	item.add_child(mesh_instance)
	var collision := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	collision.shape = shape
	item.add_child(collision)
	add_child(item)

func _build_security_cameras() -> void:
	for position in [Vector3(-10.7, 2.35, -8.2), Vector3(10.7, 2.35, -8.2), Vector3(-10.7, 2.35, 8.2), Vector3(10.7, 2.35, 8.2)]:
		_create_security_camera(position)

func _create_security_camera(position: Vector3) -> void:
	var pivot := Node3D.new()
	pivot.set_script(AmbientCameraScript)
	pivot.position = position
	var housing_mesh := SphereMesh.new()
	housing_mesh.radius = 0.16
	housing_mesh.height = 0.32
	var housing := MeshInstance3D.new()
	housing.mesh = housing_mesh
	housing.material_override = metal_material
	pivot.add_child(housing)
	var lens_mesh := SphereMesh.new()
	lens_mesh.radius = 0.055
	lens_mesh.height = 0.11
	var lens_material := _material(Color("#5dd9c6"), 0.3)
	lens_material.emission_enabled = true
	lens_material.emission = Color("#1d8c7e")
	lens_material.emission_energy_multiplier = 1.0
	var lens := MeshInstance3D.new()
	lens.name = "Lens"
	lens.mesh = lens_mesh
	lens.material_override = lens_material
	lens.position = Vector3(0, 0, 0.18)
	pivot.add_child(lens)
	add_child(pivot)
	security_cameras.append(pivot)

func _build_ui() -> void:
	var canvas := CanvasLayer.new()
	add_child(canvas)
	ui_root = Control.new()
	ui_root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	canvas.add_child(ui_root)
	_apply_ui_theme()

	_build_hud()
	_build_intro()
	_build_difficulty_overlay()

func _apply_ui_theme() -> void:
	var theme := Theme.new()
	theme.default_font_size = 16
	theme.set_color("font_color", "Label", Color("#dce8e1"))
	theme.set_color("font_color", "Button", Color("#dce8e1"))
	theme.set_color("font_hover_color", "Button", Color("#f1fff8"))
	theme.set_color("font_pressed_color", "Button", Color("#091b17"))
	theme.set_color("font_disabled_color", "Button", Color("#6d7a76"))

	var panel_style := StyleBoxFlat.new()
	panel_style.bg_color = Color("#101a1e")
	panel_style.border_color = Color("#33494a")
	panel_style.set_border_width_all(1)
	panel_style.set_corner_radius_all(9)
	panel_style.content_margin_left = 20
	panel_style.content_margin_right = 20
	panel_style.content_margin_top = 17
	panel_style.content_margin_bottom = 17
	theme.set_stylebox("panel", "PanelContainer", panel_style)

	var button_normal := StyleBoxFlat.new()
	button_normal.bg_color = Color("#17272b")
	button_normal.border_color = Color("#496663")
	button_normal.set_border_width_all(1)
	button_normal.set_corner_radius_all(6)
	button_normal.content_margin_left = 14
	button_normal.content_margin_right = 14
	button_normal.content_margin_top = 10
	button_normal.content_margin_bottom = 10

	var button_hover := button_normal.duplicate() as StyleBoxFlat
	button_hover.bg_color = Color("#20383a")
	button_hover.border_color = Color("#79d7be")
	var button_pressed := button_normal.duplicate() as StyleBoxFlat
	button_pressed.bg_color = Color("#80d7bd")
	button_pressed.border_color = Color("#80d7bd")
	theme.set_stylebox("normal", "Button", button_normal)
	theme.set_stylebox("hover", "Button", button_hover)
	theme.set_stylebox("pressed", "Button", button_pressed)
	theme.set_stylebox("focus", "Button", button_hover)
	ui_root.theme = theme

func _build_hud() -> void:
	var header := PanelContainer.new()
	header.anchor_right = 1.0
	header.offset_left = 20
	header.offset_top = 18
	header.offset_right = -20
	header.offset_bottom = 76
	ui_root.add_child(header)
	var header_row := HBoxContainer.new()
	header_row.add_theme_constant_override("separation", 24)
	header.add_child(header_row)
	var title := Label.new()
	title.text = "AIBOX  /  PRISON CONTROL"
	title.add_theme_font_size_override("font_size", 22)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header_row.add_child(title)
	status_label = Label.new()
	status_label.text = "FACILITY STANDBY"
	status_label.add_theme_color_override("font_color", Color("#79d7be"))
	status_label.add_theme_font_size_override("font_size", 15)
	header_row.add_child(status_label)

	var panel := PanelContainer.new()
	panel.anchor_left = 1.0
	panel.anchor_right = 1.0
	panel.offset_left = -410
	panel.offset_right = -20
	panel.offset_top = 92
	panel.offset_bottom = -22
	ui_root.add_child(panel)
	var stack := VBoxContainer.new()
	stack.add_theme_constant_override("separation", 13)
	panel.add_child(stack)
	var section_title := Label.new()
	section_title.text = "YOUR SHIFT"
	section_title.add_theme_font_size_override("font_size", 19)
	stack.add_child(section_title)
	budget_label = _add_hud_stat(stack, "FACILITY BUDGET", "$1,400")
	guard_label = _add_hud_stat(stack, "GUARDS", "1")
	camera_label = _add_hud_stat(stack, "CAMERAS", "4")
	turn_label = _add_hud_stat(stack, "AI TURNS", "0")

	_add_hud_button(stack, "INSTALL CAMERA  ·  $350", _buy_camera)
	_add_hud_button(stack, "HIRE GUARD  ·  $850", _hire_guard)
	_add_hud_button(stack, "TRIGGER ALARM", _trigger_alarm)
	_add_hud_button(stack, "USE / PICK UP  ·  E", _interact)
	event_label = Label.new()
	event_label.text = "Смена ещё не началась."
	event_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	event_label.add_theme_font_size_override("font_size", 13)
	event_label.add_theme_color_override("font_color", Color("#9eafa7"))
	stack.add_child(event_label)

	var controls := Label.new()
	controls.text = "WASD — движение   SHIFT — бег\nE — взаимодействие   Q — бросить предмет"
	controls.add_theme_font_size_override("font_size", 12)
	controls.add_theme_color_override("font_color", Color("#82928b"))
	stack.add_child(controls)

func _add_hud_stat(parent: VBoxContainer, label_text: String, value_text: String) -> Label:
	var label := Label.new()
	label.text = "%s       %s" % [label_text, value_text]
	label.add_theme_font_size_override("font_size", 15)
	parent.add_child(label)
	return label

func _add_hud_button(parent: VBoxContainer, text_value: String, callback: Callable) -> void:
	var button := Button.new()
	button.text = text_value
	button.custom_minimum_size.y = 44
	button.add_theme_font_size_override("font_size", 14)
	button.pressed.connect(callback)
	parent.add_child(button)

func _build_intro() -> void:
	intro_overlay = _new_overlay()
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	intro_overlay.add_child(center)
	var stack := VBoxContainer.new()
	stack.alignment = BoxContainer.ALIGNMENT_CENTER
	stack.add_theme_constant_override("separation", 19)
	stack.custom_minimum_size.x = 650
	center.add_child(stack)
	var title := Label.new()
	title.text = "AIBOX"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 82)
	title.add_theme_color_override("font_color", Color("#d8e7df"))
	stack.add_child(title)
	var tagline := Label.new()
	tagline.text = "ONE GUARD.  ONE PRISONER.  ONE WAY OUT."
	tagline.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	tagline.add_theme_font_size_override("font_size", 19)
	tagline.add_theme_color_override("font_color", Color("#e0bd88"))
	stack.add_child(tagline)
	var description := Label.new()
	description.text = "Ты — начальник смены. Заключённый ищет путь наружу.\nНаблюдай за блоком, управляй охраной и контролируй периметр."
	description.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	description.add_theme_font_size_override("font_size", 17)
	stack.add_child(description)
	_add_hud_button(stack, "ENTER FACILITY", _show_difficulty)
	_add_hud_button(stack, "EXIT  ·  ALT + F4", func(): get_tree().quit())

func _build_difficulty_overlay() -> void:
	start_overlay = _new_overlay()
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	start_overlay.add_child(center)
	var stack := VBoxContainer.new()
	stack.alignment = BoxContainer.ALIGNMENT_CENTER
	stack.add_theme_constant_override("separation", 18)
	stack.custom_minimum_size.x = 560
	center.add_child(stack)
	var title := Label.new()
	title.text = "FACILITY INITIALIZATION"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 28)
	stack.add_child(title)
	difficulty_select = OptionButton.new()
	difficulty_select.add_item("STANDARD  ·  $1,400")
	difficulty_select.add_item("STRICT  ·  $1,800")
	difficulty_select.add_item("SPECIAL  ·  $2,400")
	difficulty_select.add_item("BLACK DOLPHIN  ·  $3,200")
	difficulty_select.custom_minimum_size.y = 46
	stack.add_child(difficulty_select)
	_add_hud_button(stack, "BEGIN YOUR SHIFT", _begin_shift)
	start_overlay.visible = false

func _new_overlay() -> ColorRect:
	var overlay := ColorRect.new()
	overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	overlay.color = Color("#080e11")
	overlay.mouse_filter = Control.MOUSE_FILTER_STOP
	ui_root.add_child(overlay)
	return overlay

func _show_difficulty() -> void:
	intro_overlay.visible = false
	start_overlay.visible = true
	start_overlay.modulate.a = 0.0
	var tween := create_tween()
	tween.tween_property(start_overlay, "modulate:a", 1.0, 0.38).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)

func _begin_shift() -> void:
	var budgets := [1400, 1800, 2400, 3200]
	budget = budgets[difficulty_select.selected]
	shift_started = true
	guard.call("set_active", true)
	prisoner.call("set_active", true)
	status_label.text = "FACILITY ACTIVE"
	event_label.text = "Смена началась. Доступно физическое управление персонажем и предметами."
	var tween := create_tween()
	tween.tween_property(start_overlay, "modulate:a", 0.0, 0.42).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN)
	tween.tween_callback(func(): start_overlay.visible = false)
	_update_hud()

func _update_hud() -> void:
	budget_label.text = "FACILITY BUDGET       $%s" % str(budget)
	camera_label.text = "CAMERAS       %s" % str(camera_count)
	guard_label.text = "GUARDS       %s" % str(hired_guards.size() + 1)
	turn_label.text = "AI TURNS       %s" % str(turn_count)

func _buy_camera() -> void:
	if not shift_started:
		return
	if budget < 350:
		event_label.text = "Недостаточно средств для установки камеры."
		return
	budget -= 350
	camera_count += 1
	_create_security_camera(Vector3(-9.0 + float(camera_count % 5) * 4.0, 2.35, 7.8))
	event_label.text = "Камера установлена. Её объектив плавно сканирует сектор."
	_update_hud()

func _hire_guard() -> void:
	if not shift_started:
		return
	if budget < 850:
		event_label.text = "Недостаточно средств для найма охранника."
		return
	budget -= 850
	var npc := _create_actor("Hired guard %s" % str(hired_guards.size() + 1), Vector3(-2.0 + hired_guards.size() * 1.3, 0, 6.4), guard_material, false)
	npc.call("set_active", true)
	hired_guards.append(npc)
	_rebuild_navigation()
	event_label.text = "Охранник заступил на пост."
	_update_hud()

func _trigger_alarm() -> void:
	if not shift_started:
		return
	alarm_active = not alarm_active
	alarm_light.light_energy = 1.9 if alarm_active else 0.0
	event_label.text = "ТРЕВОГА АКТИВНА" if alarm_active else "Тревога снята."
	status_label.text = "PERIMETER ALERT" if alarm_active else "FACILITY ACTIVE"

func _interact() -> void:
	if not shift_started or guard == null:
		return
	if held_item:
		_drop_held_item()
		return
	var origin := guard.global_position + Vector3(0, 1.0, 0)
	var direction := -guard.global_transform.basis.z
	var query := PhysicsRayQueryParameters3D.create(origin, origin + direction * 2.4)
	query.exclude = [guard.get_rid()]
	var result := get_world_3d().direct_space_state.intersect_ray(query)
	if result.is_empty():
		event_label.text = "Рядом нет двери или предмета."
		return
	var collider: Object = result.get("collider")
	if collider and collider.has_method("toggle"):
		collider.call("toggle")
		event_label.text = "Дверь открыта или закрыта."
		await get_tree().create_timer(0.82).timeout
		_rebuild_navigation()
	elif collider is RigidBody3D and collider.is_in_group("pickup_items"):
		_pickup_item(collider as RigidBody3D)
	else:
		event_label.text = "Это препятствие нельзя использовать."

func _pickup_item(item: RigidBody3D) -> void:
	held_item = item
	held_item.freeze = true
	held_item.linear_velocity = Vector3.ZERO
	held_item.angular_velocity = Vector3.ZERO
	held_item.collision_layer = 0
	held_item.collision_mask = 0
	held_item.reparent(guard)
	held_item.transform = Transform3D(Basis.IDENTITY, Vector3(0.4, 0.95, 0.12))
	event_label.text = "Предмет поднят. Нажми Q, чтобы бросить."

func _drop_held_item() -> void:
	if held_item == null:
		return
	var item := held_item
	held_item = null
	item.reparent(self)
	item.global_position = guard.global_position + Vector3(0, 0.85, 0) - guard.global_transform.basis.z * 0.55
	item.global_rotation = Vector3.ZERO
	item.collision_layer = 1
	item.collision_mask = 1
	item.freeze = false
	item.apply_central_impulse(-guard.global_transform.basis.z * 2.2 + Vector3(0, 1.0, 0))
	event_label.text = "Предмет брошен. Он снова подчиняется физике."

func _input(event: InputEvent) -> void:
	if not shift_started or not event is InputEventKey or not event.pressed or event.echo:
		return
	match event.keycode:
		KEY_E:
			_interact()
		KEY_Q:
			_drop_held_item()
		KEY_SPACE:
			_trigger_alarm()
		KEY_F11:
			var mode := DisplayServer.window_get_mode()
			DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED if mode == DisplayServer.WINDOW_MODE_FULLSCREEN else DisplayServer.WINDOW_MODE_FULLSCREEN)

func _on_ai_action_result(success: bool, message: String) -> void:
	event_label.text = message
	if success:
		turn_count += 1
		_update_hud()
