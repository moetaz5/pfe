allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir = File("C:/tmp/medica_sign_build")
rootProject.layout.buildDirectory.set(newBuildDir)

subprojects {
    val newSubprojectBuildDir = File(newBuildDir, project.name)
    project.layout.buildDirectory.set(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
