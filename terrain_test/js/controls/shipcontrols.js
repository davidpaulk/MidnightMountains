 /*
 * HexGL
 * @author Thibaut 'BKcore' Despoulain <http://bkcore.com>
 * @license This work is licensed under the Creative Commons Attribution-NonCommercial 3.0 Unported License.
 *          To view a copy of this license, visit http://creativecommons.org/licenses/by-nc/3.0/.
 */

var bkcore = bkcore || {};
bkcore.hexgl = bkcore.hexgl || {};

THREE.ShipControls = function(ctx)
{
	var self = this;
	var domElement = ctx.document;

	this.active = true;
	this.destroyed = false;
	this.falling = false;

	this.dom = domElement;
	this.mesh = null;

	this.epsilon = 0.00000001;
	this.zero = new THREE.Vector3(0,0,0);
	this.airResist = 0.02;
	this.airDrift = 0.1;
	this.thrust = 0.02;
	this.airBrake = 0.02;
	this.maxSpeed = 7.0;
	this.angularSpeed = 0.005;
	this.airAngularSpeed = 0.0065;
	this.repulsionRatio = 0.5;
	this.repulsionCap = 2.5;
	this.repulsionLerp = 0.1;
	this.maxShield = 1.0;
	this.driftLerp = 0.35;
	this.angularLerp = 0.35;

	this.movement = new THREE.Vector3(0,0,0);
	this.rotation = new THREE.Vector3(0,0,0);
	this.roll = 0.0;
	this.rollAxis = new THREE.Vector3();
	this.drift = 0.0;
	this.speed = 0.0;
	this.speedRatio = 0.0;
	this.angular = 0.0;

	this.currentVelocity = new THREE.Vector3();

	this.quaternion = new THREE.Quaternion();

	this.dummy = new THREE.Object3D();
	this.dummy.useQuaternion = true;

	this.rollAngle = 0.6;
	this.rollLerp = 0.08;
	this.rollDirection = new THREE.Vector3(0,0,1);

	this.gradient = 0.0;
	this.gradientTarget = 0.0;
	this.gradientLerp = 0.05;
	this.gradientScale = 4.0;
	this.gradientVector = new THREE.Vector3(0,0,5);
	this.gradientAxis = new THREE.Vector3(1,0,0);

	this.tilt = 0.0;
	this.tiltTarget = 0.0;
	this.tiltLerp = 0.05;
	this.tiltScale = 4.0;
	this.tiltVector = new THREE.Vector3(5,0,0);
	this.tiltAxis = new THREE.Vector3(0,0,1);

	this.repulsionVLeft = new THREE.Vector3(1,0,0);
	this.repulsionVRight = new THREE.Vector3(-1,0,0);
	this.repulsionVFront = new THREE.Vector3(0,0,1);
	this.repulsionVScale = 4.0;
	this.repulsionAmount = 0.0;
	this.repulsionForce = new THREE.Vector3();

	this.fallVector = new THREE.Vector3(0,-20,0);

	this.resetPos = null;
	this.resetRot = null;

	this.key = {
		forward: false,
		backward: false,
		left: false,
		right: false,
		ltrigger: false,
		rtrigger: false,
		use: false
	};

	function onKeyDown(event)
	{
		switch(event.keyCode)
		{
			case 38: /*up*/	self.key.forward = true; break;

			case 40: /*down*/self.key.backward = true; break;

			case 37: /*left*/self.key.left = true; break;

			case 39: /*right*/self.key.right = true; break;

			case 81: /*Q*/self.key.ltrigger = true; break;
			case 65: /*A*/self.key.ltrigger = true; break;

			case 68: /*D*/self.key.rtrigger = true; break;
			case 69: /*E*/self.key.rtrigger = true; break;
		}
	};

	function onKeyUp(event)
	{
		switch(event.keyCode)
		{
			case 38: /*up*/	self.key.forward = false; break;

			case 40: /*down*/self.key.backward = false; break;

			case 37: /*left*/self.key.left = false; break;

			case 39: /*right*/self.key.right = false; break;

			case 81: /*Q*/self.key.ltrigger = false; break;
			case 65: /*A*/self.key.ltrigger = false; break;

			case 68: /*D*/self.key.rtrigger = false; break;
			case 69: /*E*/self.key.rtrigger = false; break;
		}
	};

	domElement.addEventListener('keydown', onKeyDown, false);
	domElement.addEventListener('keyup', onKeyUp, false);
};

this.control = function(threeMesh)
{
	this.mesh = threeMesh;
	this.mesh.martixAutoUpdate = false;
	this.dummy.position = this.mesh.position;
};

this.reset = function(position, rotation)
{
	this.resetPos = position;
	this.resetRot = rotation;
	this.movement.set(0,0,0);
	this.rotation.copy(rotation);
	this.roll = 0.0;
	this.drift = 0.0;
	this.speed = 0.0;
	this.speedRatio = 0.0;
	this.boost = 0.0;
	this.shield = this.maxShield;
	this.destroyed = false;

	this.dummy.position.copy(position);
	this.quaternion.set(rotation.x, rotation.y, rotation.z, 1).normalize();
	this.dummy.quaternion.set(0,0,0,1);
	this.dummy.quaternion.multiplySelf(this.quaternion);

	this.dummy.matrix.setPosition(this.dummy.position);
	this.dummy.matrix.setRotationFromQuaternion(this.dummy.quaternion);

	this.mesh.matrix.identity();
	this.mesh.applyMatrix(this.dummy.matrix);
}

this.update = function(dt) {

	this.rotation.y = 0;
	this.movement.set(0,0,0);
	this.drift += (0.0 - this.drift) * this.driftLerp;
	this.angular += (0.0 - this.angular) * this.angularLerp * 0.5;

	var rollAmount = 0.0;
	var angularAmount = 0.0;
	var yawLeap = 0.0;

	if(this.active)
	{
		if(this.orientationController != null)
		{
			angularAmount += this.orientationController.beta/45 * this.angularSpeed * dt;
			rollAmount -= this.orientationController.beta/45 * this.rollAngle;
		}
		else
		{
			if(this.key.left)
			{
				angularAmount += this.angularSpeed * dt;
				rollAmount -= this.rollAngle;
			}
			if(this.key.right)
			{
				angularAmount -= this.angularSpeed * dt;
				rollAmount += this.rollAngle;
			}
		}

		if(this.key.forward)
			this.speed += this.thrust * dt;
		else
			this.speed -= this.airResist * dt;
		if(this.key.ltrigger)
		{
			if(this.key.left)
				angularAmount += this.airAngularSpeed * dt;
			else
				angularAmount += this.airAngularSpeed * 0.5 * dt;
			this.speed -= this.airBrake * dt;
			this.drift += (this.airDrift - this.drift) * this.driftLerp;
			this.movement.x += this.speed * this.drift * dt;
			if(this.drift > 0.0)
				this.movement.z -= this.speed * this.drift * dt;
			rollAmount -= this.rollAngle * 0.7;
		}
		if(this.key.rtrigger)
		{
			if(this.key.right)
				angularAmount -= this.airAngularSpeed * dt;
			else
				angularAmount -= this.airAngularSpeed * 0.5 * dt;
			this.speed -= this.airBrake * dt;
			this.drift += (-this.airDrift - this.drift) * this.driftLerp;
			this.movement.x += this.speed * this.drift * dt;
			if(this.drift < 0.0)
				this.movement.z += this.speed * this.drift * dt;
			rollAmount += this.rollAngle * 0.7;
		}
	}

	this.angular += (angularAmount - this.angular) * this.angularLerp;
	this.rotation.y = this.angular;

	this.speed = Math.max(0.0, Math.min(this.speed, this.maxSpeed));
	this.speedRatio = this.speed / this.maxSpeed;
	this.movement.z += this.speed * dt;

	if(this.repulsionForce.isZero())
	{
		this.repulsionForce.set(0,0,0);
	}
	else
	{
		if(this.repulsionForce.z != 0.0) this.movement.z = 0;
		this.movement.addSelf(this.repulsionForce);
		this.repulsionForce.lerpSelf(this.zero, dt > 1.5 ? this.repulsionLerp*2 : this.repulsionLerp);
	}

	this.collisionPreviousPosition.copy(this.dummy.position);

	this.boosterCheck(dt);

	//this.movement.multiplyScalar(dt);
	//this.rotation.multiplyScalar(dt);

	this.dummy.translateX(this.movement.x);
	this.dummy.translateZ(this.movement.z);


	this.heightCheck(dt);
	this.dummy.translateY(this.movement.y);

	this.currentVelocity.copy(this.dummy.position).subSelf(this.collisionPreviousPosition);

	this.collisionCheck(dt);

	this.quaternion.set(this.rotation.x, this.rotation.y, this.rotation.z, 1).normalize();
	this.dummy.quaternion.multiplySelf(this.quaternion);

	this.dummy.matrix.setPosition(this.dummy.position);
	this.dummy.matrix.setRotationFromQuaternion(this.dummy.quaternion);

	if(this.shield <= 0.0)
	{
		this.shield = 0.0;
		this.destroy();
	}

	if(this.mesh != null)
	{
		this.mesh.matrix.identity();

		// Gradient (Mesh only, no dummy physics impact)
		var gradientDelta = (this.gradientTarget - (yawLeap + this.gradient)) * this.gradientLerp;
		if(Math.abs(gradientDelta) > this.epsilon) this.gradient += gradientDelta;
		if(Math.abs(this.gradient) > this.epsilon)
		{
			this.gradientAxis.set(1,0,0);
			this.mesh.matrix.rotateByAxis(this.gradientAxis, this.gradient);
		}

		// Tilting (Idem)
		var tiltDelta = (this.tiltTarget - this.tilt) * this.tiltLerp;
		if(Math.abs(tiltDelta) > this.epsilon) this.tilt += tiltDelta;
		if(Math.abs(this.tilt) > this.epsilon)
		{
			this.tiltAxis.set(0,0,1);
			this.mesh.matrix.rotateByAxis(this.tiltAxis, this.tilt);
		}

		// Rolling (Idem)
		var rollDelta = (rollAmount - this.roll) * this.rollLerp;
		if(Math.abs(rollDelta) > this.epsilon) this.roll += rollDelta;
		if(Math.abs(this.roll) > this.epsilon)
		{
			this.rollAxis.copy(this.rollDirection);
			this.mesh.matrix.rotateByAxis(this.rollAxis, this.roll);
		}

		this.mesh.applyMatrix(this.dummy.matrix);
		this.mesh.updateMatrixWorld(true);
	}
};


this.getRealSpeed = function(scale)
{
	return Math.round(
		(this.speed)
		* (scale == undefined ? 1 : scale)
	);
};

this.getRealSpeedRatio = function()
{
	return Math.min(
		this.maxSpeed,
		this.speed
	) / this.maxSpeed;
};

this.getSpeedRatio = function()
{
	return (this.speed)/ this.maxSpeed;
};


this.getPosition = function()
{
	return this.dummy.position;
}

this.getQuaternion = function()
{
	return this.dummy.quaternion;
}
