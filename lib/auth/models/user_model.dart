class UserModel {
  final String id;
  final String? email;
  final String? name;
  final String? profileImageUrl;
  final String? phoneNumber;
  final String? gender;
  final DateTime? birthDate;
  final String provider;
  final DateTime createdAt;
  final DateTime updatedAt;

  UserModel({
    required this.id,
    this.email,
    this.name,
    this.profileImageUrl,
    this.phoneNumber,
    this.gender,
    this.birthDate,
    required this.provider,
    required this.createdAt,
    required this.updatedAt,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'],
      email: json['email'],
      name: json['name'],
      profileImageUrl: json['profileImageUrl'],
      phoneNumber: json['phoneNumber'],
      gender: json['gender'],
      birthDate: json['birthDate'] != null 
          ? DateTime.parse(json['birthDate']) 
          : null,
      provider: json['provider'],
      createdAt: DateTime.parse(json['createdAt']),
      updatedAt: DateTime.parse(json['updatedAt']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'name': name,
      'profileImageUrl': profileImageUrl,
      'phoneNumber': phoneNumber,
      'gender': gender,
      'birthDate': birthDate?.toIso8601String(),
      'provider': provider,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }

  UserModel copyWith({
    String? id,
    String? email,
    String? name,
    String? profileImageUrl,
    String? phoneNumber,
    String? gender,
    DateTime? birthDate,
    String? provider,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return UserModel(
      id: id ?? this.id,
      email: email ?? this.email,
      name: name ?? this.name,
      profileImageUrl: profileImageUrl ?? this.profileImageUrl,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      gender: gender ?? this.gender,
      birthDate: birthDate ?? this.birthDate,
      provider: provider ?? this.provider,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}