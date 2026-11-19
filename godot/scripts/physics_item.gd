extends RigidBody3D

@export var item_id: StringName = &"canteen"
@export var display_name: String = "Canteen"

func _ready() -> void:
	add_to_group("pickup_items")
	mass = 1.15
	linear_damp = 0.35
	angular_damp = 0.55
	continuous_cd = true
