extends RigidBody3D

@export var item_id: StringName = &"canteen"
@export var display_name: String = "Canteen"

func _ready() -> void:
	add_to_group("pickup_items")
	continuous_cd = true
	can_sleep = true
	contact_monitor = true
	max_contacts_reported = 6
	var surface := PhysicsMaterial.new()
	match item_id:
		&"keycard":
			mass = 0.12
			linear_damp = 0.18
			angular_damp = 0.3
			surface.friction = 0.38
			surface.bounce = 0.06
		&"wrench":
			mass = 1.35
			linear_damp = 0.12
			angular_damp = 0.24
			surface.friction = 0.72
			surface.bounce = 0.025
		_:
			mass = 0.62
			linear_damp = 0.16
			angular_damp = 0.28
			surface.friction = 0.58
			surface.bounce = 0.035
	physics_material_override = surface
