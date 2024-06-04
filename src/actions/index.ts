'use server'

import { SignupFormSchema } from "@/lib/validation"
import { db } from "@/lib/db"
import * as jose from "jose"
import {cookies} from "next/headers"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { SecondStepActionProps } from "@/constants"


export async function Login({email, password} : {email: string, password: string}){
    try{
        // Check if the email exists first
        const user = await db.user.findUnique({
            where: {
                email
            }
        })
        if(!user){
            return {
                error: "Invalid email or password"
            }
        }
        // Check if the password macthes with the hashedPassword
        const bcrypt = require("bcrypt");
        const passwordsMatch = await bcrypt.compare(password, user.hashedPassword)
        if(!passwordsMatch){
            return {
                error: "Invalid email or password"
            }
        }
        // Encypting out JWT secret key
        const secret = new TextEncoder().encode(process.env.JWT_SECRET)
        // Generating the JWT token using jose
        const token = await new jose.SignJWT({email: user.email}).setProtectedHeader({alg: "HS256"}).sign(secret)
        // set the jwt token as a cookie
        cookies().set({
            name: "jwt",
            value: token,
            httpOnly: true,
            secure: true,
            sameSite: "lax"
        })
        // returning the signed in user to the client
        return {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            avatar: user.image,
        }
    }
    catch(error: any){
        return {
            error: error.message
        }
    }
}
export async function RegisterUser(values: z.infer<typeof SignupFormSchema>) {
    const {firstName, lastName, email, gender, birthDate, city, profession, password, phoneNumber} = values
    // Check if the email doesn't exist already
    try{
        const isThereUser = await db.user.findUnique({
            where: {
                email
            }
        })
        if(isThereUser){
            return {
                error: "User with the provided email already exists"
            }
        }
        // hash the password
        const bcrypt = require("bcrypt")
        const hashedPassword = await bcrypt.hash(password, 12)
        // create the new user
        const newUser = await db.user.create({
            data: {
                firstName,
                lastName,
                email,
                gender,
                birthDate,
                city,
                phoneNumber,
                profession,
                hashedPassword,
                socialLinks: [],
                preferences: [],
            }
        })

        return {
            userId: newUser.id
        }
    }
    catch(error: any){
        return {
            error: error.message
        }
    }
}
export async function SecondStepUpdate(values: SecondStepActionProps){
    const {userId, socialLinks, numberOfRoommatesNeeded, hasRentedRoom, peopleLivingWith, currentRentPrice, budget, image, description} = values
    try{
        if(!userId){
            return {
                error: "Not Authorized"
            }
        }
        await db.user.update({
            where: {
                id: userId
            },
            data: {
                socialLinks,
                numberOfRoommatesNeeded,
                hasRentedRoom,
                peopleLivingWith,
                currentRentPrice,
                budget,
                image,
                description
            }
        })
    }
    catch(error: any){
        return {
            error: error.message
        }
    }
}
export async function ThirdStepUpdate({preferences, userId}: {preferences: {question: string, answer: string}[], userId: string}){
    if(!userId){
        return {
            error: "Not Authorized"
        }
    }
    try{
        // updating the users preferences array and marking the user as completing the resgiration process
        await db.user.update({
            where: {
                id: userId
            },
            data: {
                preferences,
                completedRegistration: true
            }
        })
        // revalidate the find-roommates page to include the current user
        revalidatePath("/find-roommates")
    }
    catch(error: any){
        return {
            error: error.message
        }
    }
}